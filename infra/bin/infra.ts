#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { BandSimStack } from '../lib/infra-stack.js';

const app = new cdk.App();
new BandSimStack(app, 'BandSimStack');
