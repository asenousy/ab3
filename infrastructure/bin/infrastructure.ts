#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "@aws-cdk/core";
import { InfrastructureStack } from "../lib/infrastructure-stack";
import { PipelineStack } from "../lib/pipeline-stack";

const app = new cdk.App();
new InfrastructureStack(app, "InfrastructureStack");
// new PipelineStack(app, 'PipelineStack', {
//     env: {
//         account: '358886312461',
//         region: 'us-east-1',
//     }
// });
