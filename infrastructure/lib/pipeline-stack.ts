import {
  Construct,
  Stage,
  Stack,
  StackProps,
  StageProps,
  SecretValue,
  CfnOutput,
} from "@aws-cdk/core";
import {
  CdkPipeline,
  SimpleSynthAction,
  ShellScriptAction,
} from "@aws-cdk/pipelines";
import * as codepipeline from "@aws-cdk/aws-codepipeline";
import * as codepipeline_actions from "@aws-cdk/aws-codepipeline-actions";
import { InfrastructureStack } from "./infrastructure-stack";

class InfrastructureStage extends Stage {
  public readonly loadBalancerAddress: CfnOutput;
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);
    const { loadBalancer } = new InfrastructureStack(
      this,
      "InfrastructureStack"
    );
    this.loadBalancerAddress = new CfnOutput(loadBalancer, "LbAddress", {
      value: `http://${loadBalancer.loadBalancerDnsName}/`,
    });
  }
}

export class PipelineStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const sourceArtifact = new codepipeline.Artifact();
    const cloudAssemblyArtifact = new codepipeline.Artifact();

    const pipeline = new CdkPipeline(this, "Pipeline", {
      pipelineName: "MyAppPipeline",
      selfMutating: false,
      cloudAssemblyArtifact,
      sourceAction: new codepipeline_actions.GitHubSourceAction({
        actionName: "GitHub",
        output: sourceArtifact,
        oauthToken: SecretValue.secretsManager("GITHUB_TOKEN"),
        owner: "asenousy",
        repo: "ab3",
        branch: "master",
      }),

      synthAction: SimpleSynthAction.standardNpmSynth({
        sourceArtifact,
        cloudAssemblyArtifact,
        subdirectory: "infrastructure",
        installCommand: "npm install",
        buildCommand: "npm run build",
      }),
    });

    const infrastructure = new InfrastructureStage(
      this,
      "InfrastructureStage",
      {
        env: { account: "325003598244", region: "us-east-1" },
      }
    );
    const deployStage = pipeline.addApplicationStage(infrastructure, {
      manualApprovals: false,
    });
    deployStage.addActions(
      new ShellScriptAction({
        actionName: "IntegrationTesting",
        commands: ["curl -Ssf $URL/info.php"],
        useOutputs: {
          URL: pipeline.stackOutput(infrastructure.loadBalancerAddress),
        },
      })
    );
  }
}
