import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as ecs from "@aws-cdk/aws-ecs";
import * as ecs_patterns from "@aws-cdk/aws-ecs-patterns";

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "MyVpc", { maxAzs: 2 });

    const cluster = new ecs.Cluster(this, "MyCluster", { vpc });

    const taskDefinition = new ecs.FargateTaskDefinition(this, "TaskDef");
    taskDefinition
      .addContainer("ab-nginx", {
        image: ecs.ContainerImage.fromAsset(__dirname + "/../../nginx"),
      })
      .addPortMappings({
        containerPort: 80,
      });
    taskDefinition.addContainer("ab-php", {
      image: ecs.ContainerImage.fromAsset(__dirname + "/../../php-fpm"),
    });

    // Create a load-balanced Fargate service and make it public
    var fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(
      this,
      "MyFargateService",
      {
        cluster: cluster, // Required
        cpu: 512, // Default is 256
        desiredCount: 6, // Default is 1
        taskDefinition,
        memoryLimitMiB: 2048, // Default is 512
        publicLoadBalancer: true, // Default is false
      }
    );

    // The code that defines your stack goes here
  }
}
