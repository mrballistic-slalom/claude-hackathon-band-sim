import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
// Using pre-built backend bundle instead of NodejsFunction to avoid Docker bundling issues
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

    // Grant Bedrock model invocation to the agent runtime's role
    agentRuntime.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: [
        'arn:aws:bedrock:*::foundation-model/anthropic.*',
        'arn:aws:bedrock:*:*:inference-profile/us.anthropic.*',
      ],
    }));

    // ---------------------------------------------------------------
    // 2. Lambda Function — NodejsFunction for auto-bundling
    // ---------------------------------------------------------------
    const orchestrator = new lambda.Function(this, 'Orchestrator', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist')),
      handler: 'handler.handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
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
        allowedOrigins: ['*'],
        allowedMethods: [lambda.HttpMethod.ALL],
        allowedHeaders: ['Content-Type'],
      },
    });

    // ---------------------------------------------------------------
    // 4. Grant AgentCore invocation to Lambda
    // ---------------------------------------------------------------
    agentRuntime.grantInvokeRuntime(orchestrator);

    // Also grant direct Bedrock access as fallback
    orchestrator.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: [
        'arn:aws:bedrock:*::foundation-model/anthropic.*',
        'arn:aws:bedrock:*:*:inference-profile/us.anthropic.*',
      ],
    }));

    // ---------------------------------------------------------------
    // 5. S3 Bucket for frontend
    // ---------------------------------------------------------------
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // ---------------------------------------------------------------
    // 6. CloudFront Distribution with two origins
    // ---------------------------------------------------------------
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(websiteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(
            cdk.Fn.select(2, cdk.Fn.split('/', functionUrl.url)),
          ),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        { httpStatus: 404, responsePagePath: '/index.html', responseHttpStatus: 200 },
        { httpStatus: 403, responsePagePath: '/index.html', responseHttpStatus: 200 },
      ],
    });

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
    new cdk.CfnOutput(this, 'FunctionUrl', {
      value: functionUrl.url,
    });
  }
}
