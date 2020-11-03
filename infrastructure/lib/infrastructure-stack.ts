import { Stack, StackProps, Construct, SecretValue } from "@aws-cdk/core";
import { Vpc, SubnetType, UserData } from "@aws-cdk/aws-ec2";
import {
  Cluster,
  ContainerImage,
  AwsLogDriver,
  FargateTaskDefinition,
  Secret,
} from "@aws-cdk/aws-ecs";
import { ApplicationLoadBalancedFargateService } from "@aws-cdk/aws-ecs-patterns";
import {
  Dashboard,
  GraphWidget,
  LogQueryVisualizationType,
  LogQueryWidget,
  SingleValueWidget,
} from "@aws-cdk/aws-cloudwatch";
import {
  Credentials,
  DatabaseCluster,
  DatabaseClusterEngine,
  AuroraMysqlEngineVersion,
  ServerlessCluster,
} from "@aws-cdk/aws-rds";
import { CloudFrontToS3 } from "@aws-solutions-constructs/aws-cloudfront-s3";
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
} from "@aws-cdk/custom-resources";

export class InfrastructureStack extends Stack {
  public readonly loadBalancer: any;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new Vpc(this, "MyVpc", { maxAzs: 2 });

    ////////// CLOUDFRONT //////////////

    // new CloudFrontToS3(this as any, "my-cloudfront-s3", {});

    ///////////// SECRESTS ///////////

    // const credentials = Credentials.fromUsername("admin", {
    //   password: new SecretValue("awesomebuilder") as any,
    // });

    ////////// DB ////////////

    // const mySecret = secretsmanager.Secret.fromSecretName(
    //   this,
    //   "DBSecret",
    //   "myDBLoginInfo"
    // );

    // const db = new DatabaseCluster(this, "MyDatabase", {
    //   engine: DatabaseClusterEngine.auroraMysql({
    //     version: AuroraMysqlEngineVersion.VER_2_08_1,
    //   }),
    //   defaultDatabaseName: "ab3",
    //   instanceProps: {
    //     vpcSubnets: {
    //       subnetType: SubnetType.PRIVATE,
    //     },
    //     vpc,
    //   },
    // });

    const db = new ServerlessCluster(this, "MyDatabase", {
      engine: DatabaseClusterEngine.AURORA_MYSQL,
      defaultDatabaseName: "ecommerce",
      enableHttpEndpoint: true,
      vpc,
    });

    const prepopulate = new AwsCustomResource(this, "Prepopulate", {
      onCreate: {
        service: "RDSDataService",
        action: "ExecuteStatement",
        parameters: {
          resourceArn: db.clusterArn,
          secetArn: db.secret?.secretArn,
          database: "ecommerce",
          sql:
            "CREATE TABLE products ( productId int, name varchar(255), image varchar(255), price decimal(5, 2) ); INSERT INTO products ( productId, name, image, price ) VALUES ( 1, 'hat', 'https://via.placeholder.com/150', 12.54);",
        },
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({
        resources: AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });

    ////////// ECS ////////////

    const cluster = new Cluster(this, "MyCluster", { vpc });

    const NGINXLogDriver = new AwsLogDriver({ streamPrefix: "myNGINX" });
    const PHPLogDriver = new AwsLogDriver({ streamPrefix: "myPHP" });

    const taskDefinition = new FargateTaskDefinition(this, "TaskDef");

    const nginxContainer = taskDefinition.addContainer("ab-nginx", {
      image: ContainerImage.fromAsset(__dirname + "/../../nginx"),
      logging: NGINXLogDriver,
    });
    nginxContainer.addPortMappings({ containerPort: 80 });

    const fargateService = new ApplicationLoadBalancedFargateService(
      this,
      "MyFargateService",
      {
        cluster: cluster,
        desiredCount: 2,
        taskDefinition,
        publicLoadBalancer: true,
      }
    );
    this.loadBalancer = fargateService.loadBalancer;

    const phpContainer = taskDefinition.addContainer("ab-php", {
      image: ContainerImage.fromAsset(__dirname + "/../../php-fpm"),
      secrets: {
        DB_PW: Secret.fromSecretsManager(db.secret!),
      },
      environment: {
        DB_HOST: db.clusterEndpoint.hostname,
        DB_NAME: "ab3",
        DB_USER: "admin",
        DOMAIN: "http://" + fargateService.loadBalancer.loadBalancerDnsName,
      },
      logging: PHPLogDriver,
    });
    phpContainer.addPortMappings({ containerPort: 9000 });

    db.connections.allowDefaultPortFrom(fargateService.cluster.connections);

    /////////////////// DashBoard /////////////////////

    const dashboard = new Dashboard(this, "MyDashboard");
    dashboard.addWidgets(
      new GraphWidget({
        title: "Incoming Requests",
        width: 10,
        left: [fargateService.loadBalancer.metricRequestCount()],
      })
    );
    dashboard.addWidgets(
      new LogQueryWidget({
        title: "NGINX Logs",
        width: 20,
        logGroupNames: [NGINXLogDriver.logGroup?.logGroupName!],
        view: LogQueryVisualizationType.TABLE,
        queryLines: ["fields @timestamp, @message"],
      })
    );
    dashboard.addWidgets(
      new LogQueryWidget({
        title: "PHP Logs",
        width: 20,
        logGroupNames: [PHPLogDriver.logGroup?.logGroupName!],
        view: LogQueryVisualizationType.TABLE,
        queryLines: ["fields @timestamp, @message"],
      })
    );
  }
}
