#!/usr/bin/env node
import "dotenv/config";
import * as cdk from "aws-cdk-lib";
import { CorpusQueryStack } from "../lib/corpus-query-stack";

const app = new cdk.App();
new CorpusQueryStack(app, "CorpusQueryStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "us-east-1",
  },
});

cdk.Tags.of(app).add("Project", "CorpusQuery");
cdk.Tags.of(app).add("Purpose", process.env.PURPOSE || "Development");
