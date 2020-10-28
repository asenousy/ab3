import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as ecs from "@aws-cdk/aws-ecs";
import * as ecs_patterns from "@aws-cdk/aws-ecs-patterns";
import * as rds from "@aws-cdk/aws-rds";
import { CloudFrontToS3 } from "@aws-solutions-constructs/aws-cloudfront-s3";

export class InfrastructureStack extends cdk.Stack {
  public readonly loadBalancer: any

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "MyVpc", { maxAzs: 1 });

    ////////// CLOUDFRONT //////////////

    // new CloudFrontToS3(this as any, "my-cloudfront-s3", {});

    ////////// DB ////////////

    // const credentials = rds.Credentials.fromUsername('admin', {
    //   password: new cdk.SecretValue('awesomebuilder') as any,
    // });

    // const db = new rds.DatabaseCluster(this, "MyDatabase", {
    //   engine: rds.DatabaseClusterEngine.auroraMysql({
    //     version: rds.AuroraMysqlEngineVersion.VER_2_08_1,
    //   }),
    //   defaultDatabaseName: "ab3",
    //   credentials,
    //   instanceProps: {
    //     vpcSubnets: {
    //       subnetType: ec2.SubnetType.PRIVATE,
    //     },
    //     vpc,
    //   },
    // });

    ////////// ECS ////////////

    const cluster = new ecs.Cluster(this, "MyCluster", { vpc });

    const taskDefinition = new ecs.FargateTaskDefinition(this, "TaskDef");

    const nginxContainer = taskDefinition.addContainer("ab-nginx", {
      image: ecs.ContainerImage.fromAsset(__dirname + "/../../nginx"),
      logging: ecs.LogDriver.awsLogs({ streamPrefix: "myNGINX" }),
    });
    nginxContainer.addPortMappings({ containerPort: 80 });

    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(
      this,
      "MyFargateService",
      {
        cluster: cluster,
        desiredCount: 1, // Default is 1
        taskDefinition,
        publicLoadBalancer: true, // Default is false
      }
    );
    this.loadBalancer = fargateService.loadBalancer;

    const phpContainer = taskDefinition.addContainer("ab-php", {
      image: ecs.ContainerImage.fromAsset(__dirname + "/../../php-fpm"),
      environment: {
        // DB_HOST: db.clusterEndpoint.hostname,
        DB_HOST: '',
        DB_NAME: "ab3",
        DB_USER: 'admin',
        DB_PW: 'awesomebuilder',
        DOMAIN: "http://" + fargateService.loadBalancer.loadBalancerDnsName,
      },
      logging: ecs.LogDriver.awsLogs({ streamPrefix: "myPHP" }),
    });
    phpContainer.addPortMappings({ containerPort: 9000 });
  }
}
