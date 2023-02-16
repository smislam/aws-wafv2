#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsWafv2Stack } from '../lib/aws-wafv2-stack';

const app = new cdk.App();
new AwsWafv2Stack(app, 'AwsWafv2Stack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
});