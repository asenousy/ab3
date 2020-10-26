import { Construct, Stage, Stack, StackProps, StageProps, SecretValue } from '@aws-cdk/core';
import { CdkPipeline, SimpleSynthAction, ShellScriptAction } from '@aws-cdk/pipelines';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from "@aws-cdk/aws-codepipeline-actions";
import { InfrastructureStack } from './infrastructure-stack';

class InfrastructureStage extends Stage {
    constructor(scope: Construct, id: string, props?: StageProps) {
        super(scope, id, props);
        new InfrastructureStack(this, 'InfrastructureStack');
    }
}

export class PipelineStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const sourceArtifact = new codepipeline.Artifact();
        const cloudAssemblyArtifact = new codepipeline.Artifact();

        const pipeline = new CdkPipeline(this, 'Pipeline', {
            pipelineName: 'MyAppPipeline',
            cloudAssemblyArtifact,
            sourceAction: new codepipeline_actions.GitHubSourceAction({
                actionName: 'GitHub',
                output: sourceArtifact,
                oauthToken: new SecretValue('765b2ef6eca1e690434ac0578babc08588c794d4'),
                owner: 'asenousy',
                repo: 'ab3',
                branch: 'master',
            }),

            synthAction: SimpleSynthAction.standardNpmSynth({
                sourceArtifact,
                cloudAssemblyArtifact,
                subdirectory: 'infrastructure',
                installCommand: 'npm install',
                buildCommand: 'npm run build',
            }),
        });

        pipeline.addApplicationStage(new InfrastructureStage(this, 'InfrastructureStage', {
            env: { account: '358886312461', region: 'us-east-1' }
        }) as any);
    }
}
