"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InfrastructureStack = void 0;
const core_1 = require("@aws-cdk/core");
const aws_ec2_1 = require("@aws-cdk/aws-ec2");
const aws_ecs_1 = require("@aws-cdk/aws-ecs");
const aws_ecs_patterns_1 = require("@aws-cdk/aws-ecs-patterns");
const aws_cloudwatch_1 = require("@aws-cdk/aws-cloudwatch");
const aws_rds_1 = require("@aws-cdk/aws-rds");
const aws_cloudfront_s3_1 = require("@aws-solutions-constructs/aws-cloudfront-s3");
const custom_resources_1 = require("@aws-cdk/custom-resources");
const aws_s3_deployment_1 = require("@aws-cdk/aws-s3-deployment");
class InfrastructureStack extends core_1.Stack {
    constructor(scope, id, props) {
        var _a, _b, _c, _d, _e, _f;
        super(scope, id, props);
        const vpc = new aws_ec2_1.Vpc(this, "MyVpc", { maxAzs: 2 });
        ////////// CLOUDFRONT //////////////
        const cloudFront = new aws_cloudfront_s3_1.CloudFrontToS3(this, "my-cloudfront-s3", {});
        // prepopulate bucket with a few images
        new aws_s3_deployment_1.BucketDeployment(this, "DeployS3Images", {
            sources: [aws_s3_deployment_1.Source.asset("./static")],
            destinationBucket: cloudFront.s3Bucket,
            destinationKeyPrefix: "static",
        });
        const staticDomain = cloudFront.cloudFrontWebDistribution.distributionDomainName + "/static";
        ////////// Database ////////////
        const db = new aws_rds_1.ServerlessCluster(this, "MyDatabase", {
            engine: aws_rds_1.DatabaseClusterEngine.AURORA_MYSQL,
            defaultDatabaseName: "ecommerce",
            enableHttpEndpoint: true,
            vpc,
        });
        // prepopulate the Database with a few products
        const createTable = new custom_resources_1.AwsCustomResource(this, "CreateTable", {
            onCreate: {
                service: "RDSDataService",
                action: "executeStatement",
                parameters: {
                    resourceArn: db.clusterArn,
                    secretArn: (_a = db.secret) === null || _a === void 0 ? void 0 : _a.secretArn,
                    database: "ecommerce",
                    sql: "CREATE TABLE products ( productId int, name varchar(255), image varchar(255), price decimal(5, 2) );",
                },
                physicalResourceId: custom_resources_1.PhysicalResourceId.of(Date.now().toString()),
            },
            policy: custom_resources_1.AwsCustomResourcePolicy.fromSdkCalls({
                resources: custom_resources_1.AwsCustomResourcePolicy.ANY_RESOURCE,
            }),
        });
        (_b = db.secret) === null || _b === void 0 ? void 0 : _b.grantRead(createTable);
        const insertTable = new custom_resources_1.AwsCustomResource(this, "InsertTable", {
            onCreate: {
                service: "RDSDataService",
                action: "executeStatement",
                parameters: {
                    resourceArn: db.clusterArn,
                    secretArn: (_c = db.secret) === null || _c === void 0 ? void 0 : _c.secretArn,
                    database: "ecommerce",
                    sql: `INSERT INTO products VALUES ( 1, 'hat', 'https://${staticDomain}/hat.jpeg', 12.55), ( 2, 'shoe', 'https://${staticDomain}/shoe.jpg', 19.85);`,
                },
                physicalResourceId: custom_resources_1.PhysicalResourceId.of(Date.now().toString()),
            },
            policy: custom_resources_1.AwsCustomResourcePolicy.fromSdkCalls({
                resources: custom_resources_1.AwsCustomResourcePolicy.ANY_RESOURCE,
            }),
        });
        (_d = db.secret) === null || _d === void 0 ? void 0 : _d.grantRead(insertTable);
        insertTable.node.addDependency(createTable);
        ////////// ECS ////////////
        const cluster = new aws_ecs_1.Cluster(this, "MyCluster", { vpc });
        const NGINXLogDriver = new aws_ecs_1.AwsLogDriver({ streamPrefix: "myNGINX" });
        const PHPLogDriver = new aws_ecs_1.AwsLogDriver({ streamPrefix: "myPHP" });
        const taskDefinition = new aws_ecs_1.FargateTaskDefinition(this, "TaskDef");
        const nginxContainer = taskDefinition.addContainer("ab-nginx", {
            image: aws_ecs_1.ContainerImage.fromAsset(__dirname + "/../../nginx"),
            logging: NGINXLogDriver,
        });
        nginxContainer.addPortMappings({ containerPort: 80 });
        const fargateService = new aws_ecs_patterns_1.ApplicationLoadBalancedFargateService(this, "MyFargateService", {
            cluster: cluster,
            desiredCount: 2,
            taskDefinition,
            publicLoadBalancer: true,
        });
        this.loadBalancer = fargateService.loadBalancer;
        const phpContainer = taskDefinition.addContainer("ab-php", {
            image: aws_ecs_1.ContainerImage.fromAsset(__dirname + "/../../php-fpm"),
            environment: {
                DOMAIN: "http://" + fargateService.loadBalancer.loadBalancerDnsName,
            },
            secrets: {
                SECRETS: aws_ecs_1.Secret.fromSecretsManager(db.secret),
            },
            logging: PHPLogDriver,
        });
        phpContainer.addPortMappings({ containerPort: 9000 });
        db.connections.allowDefaultPortFromAnyIpv4();
        /////////////////// CloudWatch DashBoard /////////////////////
        const dashboard = new aws_cloudwatch_1.Dashboard(this, "MyDashboard");
        dashboard.addWidgets(new aws_cloudwatch_1.TextWidget({
            markdown: "# Load Balancer\nmetrics to monitor load balancer metrics:\n* Amount of incoming requests\n* Latency with an alarm if max accepted latency exceeded.",
            width: 6,
            height: 6,
        }), new aws_cloudwatch_1.GraphWidget({
            title: "Requests",
            width: 9,
            left: [fargateService.loadBalancer.metricRequestCount()],
        }), new aws_cloudwatch_1.GraphWidget({
            title: "Latency",
            width: 9,
            left: [fargateService.loadBalancer.metricTargetResponseTime()],
        }));
        dashboard.addWidgets(new aws_cloudwatch_1.LogQueryWidget({
            title: "NGINX Logs",
            width: 24,
            logGroupNames: [(_e = NGINXLogDriver.logGroup) === null || _e === void 0 ? void 0 : _e.logGroupName],
            view: aws_cloudwatch_1.LogQueryVisualizationType.TABLE,
            queryLines: ["fields @timestamp, @message"],
        }));
        dashboard.addWidgets(new aws_cloudwatch_1.LogQueryWidget({
            title: "PHP Logs",
            width: 24,
            logGroupNames: [(_f = PHPLogDriver.logGroup) === null || _f === void 0 ? void 0 : _f.logGroupName],
            view: aws_cloudwatch_1.LogQueryVisualizationType.TABLE,
            queryLines: ["fields @timestamp, @message"],
        }));
    }
}
exports.InfrastructureStack = InfrastructureStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5mcmFzdHJ1Y3R1cmUtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmZyYXN0cnVjdHVyZS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx3Q0FBNkQ7QUFDN0QsOENBQXVDO0FBQ3ZDLDhDQU0wQjtBQUMxQixnRUFBa0Y7QUFDbEYsNERBTWlDO0FBQ2pDLDhDQUE0RTtBQUM1RSxtRkFBNkU7QUFDN0UsZ0VBSW1DO0FBQ25DLGtFQUFzRTtBQUV0RSxNQUFhLG1CQUFvQixTQUFRLFlBQUs7SUFHNUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFrQjs7UUFDMUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxHQUFHLEdBQUcsSUFBSSxhQUFHLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBRWxELG9DQUFvQztRQUVwQyxNQUFNLFVBQVUsR0FBRyxJQUFJLGtDQUFjLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRXBFLHVDQUF1QztRQUN2QyxJQUFJLG9DQUFnQixDQUFDLElBQUksRUFBRSxnQkFBZ0IsRUFBRTtZQUMzQyxPQUFPLEVBQUUsQ0FBQywwQkFBTSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUNuQyxpQkFBaUIsRUFBRSxVQUFVLENBQUMsUUFBUztZQUN2QyxvQkFBb0IsRUFBRSxRQUFRO1NBQy9CLENBQUMsQ0FBQztRQUNILE1BQU0sWUFBWSxHQUNoQixVQUFVLENBQUMseUJBQXlCLENBQUMsc0JBQXNCLEdBQUcsU0FBUyxDQUFDO1FBRTFFLGdDQUFnQztRQUVoQyxNQUFNLEVBQUUsR0FBRyxJQUFJLDJCQUFpQixDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7WUFDbkQsTUFBTSxFQUFFLCtCQUFxQixDQUFDLFlBQVk7WUFDMUMs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Qy9ELENBQUMsQ0FDSCxDQUFDO1FBQ0YsU0FBUyxDQUFDLFVBQVUsQ0FDbEIsSUFBSSwrQkFBYyxDQUFDO1lBQ2pCLEtBQUssRUFBRSxZQUFZO1lBQ25CLEtBQUssRUFBRSxFQUFFO1lBQ1QsYUFBYSxFQUFFLENBQUMsTUFBQSxjQUFjLENBQUMsUUFBUSwwQ0FBRSxZQUFhLENBQUM7WUFDdkQsSUFBSSxFQUFFLDBDQUF5QixDQUFDLEtBQUs7WUFDckMsVUFBVSxFQUFFLENBQUMsNkJBQTZCLENBQUM7U0FDNUMsQ0FBQyxDQUNILENBQUM7UUFDRixTQUFTLENBQUMsVUFBVSxDQUNsQixJQUFJLCtCQUFjLENBQUM7WUFDakIsS0FBSyxFQUFFLFVBQVU7WUFDakIsS0FBSyxFQUFFLEVBQUU7WUFDVCxhQUFhLEVBQUUsQ0FBQyxNQUFBLFlBQVksQ0FBQyxRQUFRLDBDQUFFLFlBQWEsQ0FBQztZQUNyRCxJQUFJLEVBQUUsMENBQXlCLENBQUMsS0FBSztZQUNyQyxVQUFVLEVBQUUsQ0FBQyw2QkFBNkIsQ0FBQztTQUM1QyxDQUFDLENBQ0gsQ0FBQztJQUNKLENBQUM7Q0FDRjtBQXZKRCxrREF1SkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBTdGFjaywgU3RhY2tQcm9wcywgQ29uc3RydWN0IH0gZnJvbSBcIkBhd3MtY2RrL2NvcmVcIjtcbmltcG9ydCB7IFZwYyB9IGZyb20gXCJAYXdzLWNkay9hd3MtZWMyXCI7XG5pbXBvcnQge1xuICBDbHVzdGVyLFxuICBDb250YWluZXJJbWFnZSxcbiAgQXdzTG9nRHJpdmVyLFxuICBGYXJnYXRlVGFza0RlZmluaXRpb24sXG4gIFNlY3JldCxcbn0gZnJvbSBcIkBhd3MtY2RrL2F3cy1lY3NcIjtcbmltcG9ydCB7IEFwcGxpY2F0aW9uTG9hZEJhbGFuY2VkRmFyZ2F0ZVNlcnZpY2UgfSBmcm9tIFwiQGF3cy1jZGsvYXdzLWVjcy1wYXR0ZXJuc1wiO1xuaW1wb3J0IHtcbiAgRGFzaGJvYXJkLFxuICBHcmFwaFdpZGdldCxcbiAgVGV4dFdpZGdldCxcbiAgTG9nUXVlcnlWaXN1YWxpemF0aW9uVHlwZSxcbiAgTG9nUXVlcnlXaWRnZXQsXG59IGZyb20gXCJAYXdzLWNkay9hd3MtY2xvdWR3YXRjaFwiO1xuaW1wb3J0IHsgRGF0YWJhc2VDbHVzdGVyRW5naW5lLCBTZXJ2ZXJsZXNzQ2x1c3RlciB9IGZyb20gXCJAYXdzLWNkay9hd3MtcmRzXCI7XG5pbXBvcnQgeyBDbG91ZEZyb250VG9TMyB9IGZyb20gXCJAYXdzLXNvbHV0aW9ucy1jb25zdHJ1Y3RzL2F3cy1jbG91ZGZyb250LXMzXCI7XG5pbXBvcnQge1xuICBBd3NDdXN0b21SZXNvdXJjZSxcbiAgQXdzQ3VzdG9tUmVzb3VyY2VQb2xpY3ksXG4gIFBoeXNpY2FsUmVzb3VyY2VJZCxcbn0gZnJvbSBcIkBhd3MtY2RrL2N1c3RvbS1yZXNvdXJjZXNcIjtcbmltcG9ydCB7IEJ1Y2tldERlcGxveW1lbnQsIFNvdXJjZSB9IGZyb20gXCJAYXdzLWNkay9hd3MtczMtZGVwbG95bWVudFwiO1xuXG5leHBvcnQgY2xhc3MgSW5mcmFzdHJ1Y3R1cmVTdGFjayBleHRlbmRzIFN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IGxvYWRCYWxhbmNlcjogYW55O1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3QgdnBjID0gbmV3IFZwYyh0aGlzLCBcIk15VnBjXCIsIHsgbWF4QXpzOiAyIH0pO1xuXG4gICAgLy8vLy8vLy8vLyBDTE9VREZST05UIC8vLy8vLy8vLy8vLy8vXG5cbiAgICBjb25zdCBjbG91ZEZyb250ID0gbmV3IENsb3VkRnJvbnRUb1MzKHRoaXMsIFwibXktY2xvdWRmcm9udC1zM1wiLCB7fSk7XG5cbiAgICAvLyBwcmVwb3B1bGF0ZSBidWNrZXQgd2l0aCBhIGZldyBpbWFnZXNcbiAgICBuZXcgQnVja2V0RGVwbG95bWVudCh0aGlzLCBcIkRlcGxveVMzSW1hZ2VzXCIsIHtcbiAgICAgIHNvdXJjZXM6IFtTb3VyY2UuYXNzZXQoXCIuL3N0YXRpY1wiKV0sXG4gICAgICBkZXN0aW5hdGlvbkJ1Y2tldDogY2xvdWRGcm9udC5zM0J1Y2tldCEsXG4gICAgICBkZXN0aW5hdGlvbktleVByZWZpeDogXCJzdGF0aWNcIixcbiAgICB9KTtcbiAgICBjb25zdCBzdGF0aWNEb21haW4gPVxuICAgICAgY2xvdWRGcm9udC5jbG91ZEZyb250V2ViRGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWUgKyBcIi9zdGF0aWNcIjtcblxuICAgIC8vLy8vLy8vLy8gRGF0YWJhc2UgLy8vLy8vLy8vLy8vXG5cbiAgICBjb25zdCBkYiA9IG5ldyBTZXJ2ZXJsZXNzQ2x1c3Rlcih0aGlzLCBcIk15RGF0YWJhc2VcIiwge1xuICAgICAgZW5naW5lOiBEYXRhYmFzZUNsdXN0ZXJFbmdpbmUuQVVST1JBX01ZU1FMLFxuICAgICAgZGVmYXVsdERhdGFiYXNlTmFtZTogXCJlY29tbWVyY2VcIixcbiAgICAgIGVuYWJsZUh0dHBFbmRwb2ludDogdHJ1ZSxcbiAgICAgIHZwYyxcbiAgICB9KTtcblxuICAgIC8vIHByZXBvcHVsYXRlIHRoZSBEYXRhYmFzZSB3aXRoIGEgZmV3IHByb2R1Y3RzXG4gICAgY29uc3QgY3JlYXRlVGFibGUgPSBuZXcgQXdzQ3VzdG9tUmVzb3VyY2UodGhpcywgXCJDcmVhdGVUYWJsZVwiLCB7XG4gICAgICBvbkNyZWF0ZToge1xuICAgICAgICBzZXJ2aWNlOiBcIlJEU0RhdGFTZXJ2aWNlXCIsXG4gICAgICAgIGFjdGlvbjogXCJleGVjdXRlU3RhdGVtZW50XCIsXG4gICAgICAgIHBhcmFtZXRlcnM6IHtcbiAgICAgICAgICByZXNvdXJjZUFybjogZGIuY2x1c3RlckFybixcbiAgICAgICAgICBzZWNyZXRBcm46IGRiLnNlY3JldD8uc2VjcmV0QXJuLFxuICAgICAgICAgIGRhdGFiYXNlOiBcImVjb21tZXJjZVwiLFxuICAgICAgICAgIHNxbDpcbiAgICAgICAgICAgIFwiQ1JFQVRFIFRBQkxFIHByb2R1Y3RzICggcHJvZHVjdElkIGludCwgbmFtZSB2YXJjaGFyKDI1NSksIGltYWdlIHZhcmNoYXIoMjU1KSwgcHJpY2UgZGVjaW1hbCg1LCAyKSApO1wiLFxuICAgICAgICB9LFxuICAgICAgICBwaHlzaWNhbFJlc291cmNlSWQ6IFBoeXNpY2FsUmVzb3VyY2VJZC5vZihEYXRlLm5vdygpLnRvU3RyaW5nKCkpLFxuICAgICAgfSxcbiAgICAgIHBvbGljeTogQXdzQ3VzdG9tUmVzb3VyY2VQb2xpY3kuZnJvbVNka0NhbGxzKHtcbiAgICAgICAgcmVzb3VyY2VzOiBBd3NDdXN0b21SZXNvdXJjZVBvbGljeS5BTllfUkVTT1VSQ0UsXG4gICAgICB9KSxcbiAgICB9KTtcbiAgICBkYi5zZWNyZXQ/LmdyYW50UmVhZChjcmVhdGVUYWJsZSk7XG5cbiAgICBjb25zdCBpbnNlcnRUYWJsZSA9IG5ldyBBd3NDdXN0b21SZXNvdXJjZSh0aGlzLCBcIkluc2VydFRhYmxlXCIsIHtcbiAgICAgIG9uQ3JlYXRlOiB7XG4gICAgICAgIHNlcnZpY2U6IFwiUkRTRGF0YVNlcnZpY2VcIixcbiAgICAgICAgYWN0aW9uOiBcImV4ZWN1dGVTdGF0ZW1lbnRcIixcbiAgICAgICAgcGFyYW1ldGVyczoge1xuICAgICAgICAgIHJlc291cmNlQXJuOiBkYi5jbHVzdGVyQXJuLFxuICAgICAgICAgIHNlY3JldEFybjogZGIuc2VjcmV0Py5zZWNyZXRBcm4sXG4gICAgICAgICAgZGF0YWJhc2U6IFwiZWNvbW1lcmNlXCIsXG4gICAgICAgICAgc3FsOiBgSU5TRVJUIElOVE8gcHJvZHVjdHMgVkFMVUVTICggMSwgJ2hhdCcsICdodHRwczovLyR7c3RhdGljRG9tYWlufS9oYXQuanBlZycsIDEyLjU1KSwgKCAyLCAnc2hvZScsICdodHRwczovLyR7c3RhdGljRG9tYWlufS9zaG9lLmpwZycsIDE5Ljg1KTtgLFxuICAgICAgICB9LFxuICAgICAgICBwaHlzaWNhbFJlc291cmNlSWQ6IFBoeXNpY2FsUmVzb3VyY2VJZC5vZihEYXRlLm5vdygpLnRvU3RyaW5nKCkpLFxuICAgICAgfSxcbiAgICAgIHBvbGljeTogQXdzQ3VzdG9tUmVzb3VyY2VQb2xpY3kuZnJvbVNka0NhbGxzKHtcbiAgICAgICAgcmVzb3VyY2VzOiBBd3NDdXN0b21SZXNvdXJjZVBvbGljeS5BTllfUkVTT1VSQ0UsXG4gICAgICB9KSxcbiAgICB9KTtcbiAgICBkYi5zZWNyZXQ/LmdyYW50UmVhZChpbnNlcnRUYWJsZSk7XG5cbiAgICBpbnNlcnRUYWJsZS5ub2RlLmFkZERlcGVuZGVuY3koY3JlYXRlVGFibGUpO1xuXG4gICAgLy8vLy8vLy8vLyBFQ1MgLy8vLy8vLy8vLy8vXG5cbiAgICBjb25zdCBjbHVzdGVyID0gbmV3IENsdXN0ZXIodGhpcywgXCJNeUNsdXN0ZXJcIiwgeyB2cGMgfSk7XG5cbiAgICBjb25zdCBOR0lOWExvZ0RyaXZlciA9IG5ldyBBd3NMb2dEcml2ZXIoeyBzdHJlYW1QcmVmaXg6IFwibXlOR0lOWFwiIH0pO1xuICAgIGNvbnN0IFBIUExvZ0RyaXZlciA9IG5ldyBBd3NMb2dEcml2ZXIoeyBzdHJlYW1QcmVmaXg6IFwibXlQSFBcIiB9KTtcblxuICAgIGNvbnN0IHRhc2tEZWZpbml0aW9uID0gbmV3IEZhcmdhdGVUYXNrRGVmaW5pdGlvbih0aGlzLCBcIlRhc2tEZWZcIik7XG5cbiAgICBjb25zdCBuZ2lueENvbnRhaW5lciA9IHRhc2tEZWZpbml0aW9uLmFkZENvbnRhaW5lcihcImFiLW5naW54XCIsIHtcbiAgICAgIGltYWdlOiBDb250YWluZXJJbWFnZS5mcm9tQXNzZXQoX19kaXJuYW1lICsgXCIvLi4vLi4vbmdpbnhcIiksXG4gICAgICBsb2dnaW5nOiBOR0lOWExvZ0RyaXZlcixcbiAgICB9KTtcbiAgICBuZ2lueENvbnRhaW5lci5hZGRQb3J0TWFwcGluZ3MoeyBjb250YWluZXJQb3J0OiA4MCB9KTtcblxuICAgIGNvbnN0IGZhcmdhdGVTZXJ2aWNlID0gbmV3IEFwcGxpY2F0aW9uTG9hZEJhbGFuY2VkRmFyZ2F0ZVNlcnZpY2UoXG4gICAgICB0aGlzLFxuICAgICAgXCJNeUZhcmdhdGVTZXJ2aWNlXCIsXG4gICAgICB7XG4gICAgICAgIGNsdXN0ZXI6IGNsdXN0ZXIsXG4gICAgICAgIGRlc2lyZWRDb3VudDogMixcbiAgICAgICAgdGFza0RlZmluaXRpb24sXG4gICAgICAgIHB1YmxpY0xvYWRCYWxhbmNlcjogdHJ1ZSxcbiAgICAgIH1cbiAgICApO1xuICAgIHRoaXMubG9hZEJhbGFuY2VyID0gZmFyZ2F0ZVNlcnZpY2UubG9hZEJhbGFuY2VyO1xuXG4gICAgY29uc3QgcGhwQ29udGFpbmVyID0gdGFza0RlZmluaXRpb24uYWRkQ29udGFpbmVyKFwiYWItcGhwXCIsIHtcbiAgICAgIGltYWdlOiBDb250YWluZXJJbWFnZS5mcm9tQXNzZXQoX19kaXJuYW1lICsgXCIvLi4vLi4vcGhwLWZwbVwiKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIERPTUFJTjogXCJodHRwOi8vXCIgKyBmYXJnYXRlU2VydmljZS5sb2FkQmFsYW5jZXIubG9hZEJhbGFuY2VyRG5zTmFtZSxcbiAgICAgIH0sXG4gICAgICBzZWNyZXRzOiB7XG4gICAgICAgIFNFQ1JFVFM6IFNlY3JldC5mcm9tU2VjcmV0c01hbmFnZXIoZGIuc2VjcmV0ISksXG4gICAgICB9LFxuICAgICAgbG9nZ2luZzogUEhQTG9nRHJpdmVyLFxuICAgIH0pO1xuICAgIHBocENvbnRhaW5lci5hZGRQb3J0TWFwcGluZ3MoeyBjb250YWluZXJQb3J0OiA5MDAwIH0pO1xuXG4gICAgZGIuY29ubmVjdGlvbnMuYWxsb3dEZWZhdWx0UG9ydEZyb21BbnlJcHY0KCk7XG5cbiAgICAvLy8vLy8vLy8vLy8vLy8vLy8vIENsb3VkV2F0Y2ggRGFzaEJvYXJkIC8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG4gICAgY29uc3QgZGFzaGJvYXJkID0gbmV3IERhc2hib2FyZCh0aGlzLCBcIk15RGFzaGJvYXJkXCIpO1xuICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKFxuICAgICAgbmV3IFRleHRXaWRnZXQoe1xuICAgICAgICBtYXJrZG93bjpcbiAgICAgICAgICBcIiMgTG9hZCBCYWxhbmNlclxcbm1ldHJpY3MgdG8gbW9uaXRvciBsb2FkIGJhbGFuY2VyIG1ldHJpY3M6XFxuKiBBbW91bnQgb2YgaW5jb21pbmcgcmVxdWVzdHNcXG4qIExhdGVuY3kgd2l0aCBhbiBhbGFybSBpZiBtYXggYWNjZXB0ZWQgbGF0ZW5jeSBleGNlZWRlZC5cIixcbiAgICAgICAgd2lkdGg6IDYsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgIH0pLFxuICAgICAgbmV3IEdyYXBoV2lkZ2V0KHtcbiAgICAgICAgdGl0bGU6IFwiUmVxdWVzdHNcIixcbiAgICAgICAgd2lkdGg6IDksXG4gICAgICAgIGxlZnQ6IFtmYXJnYXRlU2VydmljZS5sb2FkQmFsYW5jZXIubWV0cmljUmVxdWVzdENvdW50KCldLFxuICAgICAgfSksXG4gICAgICBuZXcgR3JhcGhXaWRnZXQoe1xuICAgICAgICB0aXRsZTogXCJMYXRlbmN5XCIsXG4gICAgICAgIHdpZHRoOiA5LFxuICAgICAgICBsZWZ0OiBbZmFyZ2F0ZVNlcnZpY2UubG9hZEJhbGFuY2VyLm1ldHJpY1RhcmdldFJlc3BvbnNlVGltZSgpXSxcbiAgICAgIH0pXG4gICAgKTtcbiAgICBkYXNoYm9hcmQuYWRkV2lkZ2V0cyhcbiAgICAgIG5ldyBMb2dRdWVyeVdpZGdldCh7XG4gICAgICAgIHRpdGxlOiBcIk5HSU5YIExvZ3NcIixcbiAgICAgICAgd2lkdGg6IDI0LFxuICAgICAgICBsb2dHcm91cE5hbWVzOiBbTkdJTlhMb2dEcml2ZXIubG9nR3JvdXA/LmxvZ0dyb3VwTmFtZSFdLFxuICAgICAgICB2aWV3OiBMb2dRdWVyeVZpc3VhbGl6YXRpb25UeXBlLlRBQkxFLFxuICAgICAgICBxdWVyeUxpbmVzOiBbXCJmaWVsZHMgQHRpbWVzdGFtcCwgQG1lc3NhZ2VcIl0sXG4gICAgICB9KVxuICAgICk7XG4gICAgZGFzaGJvYXJkLmFkZFdpZGdldHMoXG4gICAgICBuZXcgTG9nUXVlcnlXaWRnZXQoe1xuICAgICAgICB0aXRsZTogXCJQSFAgTG9nc1wiLFxuICAgICAgICB3aWR0aDogMjQsXG4gICAgICAgIGxvZ0dyb3VwTmFtZXM6IFtQSFBMb2dEcml2ZXIubG9nR3JvdXA/LmxvZ0dyb3VwTmFtZSFdLFxuICAgICAgICB2aWV3OiBMb2dRdWVyeVZpc3VhbGl6YXRpb25UeXBlLlRBQkxFLFxuICAgICAgICBxdWVyeUxpbmVzOiBbXCJmaWVsZHMgQHRpbWVzdGFtcCwgQG1lc3NhZ2VcIl0sXG4gICAgICB9KVxuICAgICk7XG4gIH1cbn1cbiJdfQ==