import * as path from 'path';
import * as crypto from 'crypto';
import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as agentcore from '@aws-cdk/aws-bedrock-agentcore-alpha';
import { Construct } from 'constructs';

export class BandSimStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ---------------------------------------------------------------
    // 1. AgentCore Runtime — deploy the Python agent from ../agent/
    // ---------------------------------------------------------------
    const agentRuntime = new agentcore.Runtime(this, 'BandAgent', {
      runtimeName: 'band_sim_agent',
      agentRuntimeArtifact: agentcore.AgentRuntimeArtifact.fromCodeAsset({
        path: path.join(__dirname, '../../agent'),
        runtime: agentcore.AgentCoreRuntime.PYTHON_3_12,
        entrypoint: ['main.py'],
      }),
      networkConfiguration: agentcore.RuntimeNetworkConfiguration.usingPublicNetwork(),
      environmentVariables: {
        MODEL_ID: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
      },
    });

    // Grant Bedrock model invocation to the agent runtime's role (scoped to specific model)
    const bedrockResources = [
      `arn:aws:bedrock:${cdk.Stack.of(this).region}::foundation-model/anthropic.claude-sonnet*`,
      `arn:aws:bedrock:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:inference-profile/us.anthropic.claude-sonnet*`,
    ];
    agentRuntime.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: bedrockResources,
    }));

    // ---------------------------------------------------------------
    // 2. Lambda Function — NodejsFunction for auto-bundling
    // ---------------------------------------------------------------
    const orchestrator = new lambda.Function(this, 'Orchestrator', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
      handler: 'handler.handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      reservedConcurrentExecutions: 10,
      environment: {
        AGENT_RUNTIME_ARN: agentRuntime.agentRuntimeArn,
        AWS_REGION_NAME: cdk.Stack.of(this).region,
      },
    });

    // ---------------------------------------------------------------
    // 3. Lambda Function URL with streaming
    // ---------------------------------------------------------------
    const functionUrl = orchestrator.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
      cors: {
        // Restrict to CloudFront origins only (can't reference distribution domain due to circular dep)
        allowedOrigins: ['https://*.cloudfront.net'],
        allowedMethods: [lambda.HttpMethod.POST],
        allowedHeaders: ['Content-Type'],
      },
    });

    // ---------------------------------------------------------------
    // 4. Grant AgentCore invocation to Lambda
    // ---------------------------------------------------------------
    agentRuntime.grantInvokeRuntime(orchestrator);

    // Also grant direct Bedrock access as fallback (scoped to specific model)
    orchestrator.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: bedrockResources,
    }));

    // ---------------------------------------------------------------
    // 5. S3 Buckets for frontend + access logging
    // ---------------------------------------------------------------
    const accessLogsBucket = new s3.Bucket(this, 'AccessLogsBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [{ expiration: cdk.Duration.days(90) }],
    });

    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      serverAccessLogsBucket: accessLogsBucket,
      serverAccessLogsPrefix: 'website-access-logs/',
    });

    // ---------------------------------------------------------------
    // 6. CloudFront Distribution with two origins + security headers
    // ---------------------------------------------------------------
    // Secret header for CloudFront-only Lambda access (Task 8)
    const originVerifySecret = crypto.randomBytes(32).toString('hex');

    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeadersPolicy', {
      responseHeadersPolicyName: 'BandSimSecurityHeaders',
      securityHeadersBehavior: {
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        strictTransportSecurity: {
          accessControlMaxAge: cdk.Duration.seconds(63072000),
          includeSubdomains: true,
          preload: true,
          override: true,
        },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
        contentSecurityPolicy: {
          contentSecurityPolicy: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'",
          override: true,
        },
      },
      customHeadersBehavior: {
        customHeaders: [
          { header: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()', override: true },
        ],
      },
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(websiteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(
            cdk.Fn.select(2, cdk.Fn.split('/', functionUrl.url)),
            { customHeaders: { 'X-Origin-Verify': originVerifySecret } },
          ),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          responseHeadersPolicy,
        },
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        { httpStatus: 404, responsePagePath: '/index.html', responseHttpStatus: 200 },
        { httpStatus: 403, responsePagePath: '/index.html', responseHttpStatus: 200 },
      ],
    });

    // Pass CloudFront URL and origin verify secret to Lambda
    orchestrator.addEnvironment('ALLOWED_ORIGIN', `https://${distribution.distributionDomainName}`);
    orchestrator.addEnvironment('ORIGIN_VERIFY_SECRET', originVerifySecret);

    // ---------------------------------------------------------------
    // 7. BucketDeployment to upload frontend
    // ---------------------------------------------------------------
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../frontend/dist'))],
      destinationBucket: websiteBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    // ---------------------------------------------------------------
    // 8. Outputs
    // ---------------------------------------------------------------
    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${distribution.distributionDomainName}`,
    });
  }
}
