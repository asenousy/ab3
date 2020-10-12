import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as ecs from "@aws-cdk/aws-ecs";
import * as ecs_patterns from "@aws-cdk/aws-ecs-patterns";
import * as rds from "@aws-cdk/aws-rds";

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "MyVpc", { maxAzs: 2 });

    const credentials = rds.Credentials.fromUsername("admin", {
      password: new cdk.SecretValue("awesomebuilder"),
    });

    ////////// DB ////////////

    const db = new rds.DatabaseCluster(this, "MyDatabase", {
      engine: rds.DatabaseClusterEngine.auroraMysql({
        version: rds.AuroraMysqlEngineVersion.VER_2_08_1,
      }),
      defaultDatabaseName: "ab3",
      credentials,
      instanceProps: {
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE,
        },
        vpc,
      },
    });

    ////////// ECS ////////////

    const cluster = new ecs.Cluster(this, "MyCluster", { vpc });

    const taskDefinition = new ecs.FargateTaskDefinition(this, "TaskDef");

    const nginxContainer = taskDefinition.addContainer("ab-nginx", {
      image: ecs.ContainerImage.fromAsset(__dirname + "/../../nginx"),
    });
    nginxContainer.addPortMappings({ containerPort: 80 });

    const phpContainer = taskDefinition.addContainer("ab-php", {
      image: ecs.ContainerImage.fromAsset(__dirname + "/../../php-fpm"),
      // secrets: {
      //   DB_USER: ecs.Secret.fromSecretsManager(credentials),
      //   DB_PW: ecs.Secret.fromSecretsManager(credentials),
      // },
      environment: {
        DB_HOST: db.clusterEndpoint.hostname,
        DB_NAME: "ab3",
        DB_USER: "admin",
        DB_PW: "awesomebuilder",
      },
    });
    phpContainer.addPortMappings({ containerPort: 9000 });

    // Create a load-balanced Fargate service and make it public
    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(
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
  }
}
