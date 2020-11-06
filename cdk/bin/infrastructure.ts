#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "@aws-cdk/core";
import { InfrastructureStack } from "../lib/infrastructure-stack";
import { PipelineStack } from "../lib/pipeline-stack";

const app = new cdk.App();
// Use for direct deploy to an environment without pipeline
// new InfrastructureStack(app, "InfrastructureStack");
// Use to deploy the pipeline stack
new PipelineStack(app, "PipelineStack");
// new PipelineStack(app, "PipelineStack", { env: { region: "us-east-1" } });
