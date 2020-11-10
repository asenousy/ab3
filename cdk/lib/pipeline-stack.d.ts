import { Construct, Stage, Stack, StackProps, StageProps, CfnOutput } from "@aws-cdk/core";
export declare class InfrastructureStage extends Stage {
    readonly loadBalancerAddress: CfnOutput;
    constructor(scope: Construct, id: string, props?: StageProps);
}
export declare class PipelineStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps);
}
