import { Stack, StackProps, Construct } from "@aws-cdk/core";
export declare class InfrastructureStack extends Stack {
    readonly loadBalancer: any;
    constructor(scope: Construct, id: string, props?: StackProps);
}
