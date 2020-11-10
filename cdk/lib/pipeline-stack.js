"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineStack = exports.InfrastructureStage = void 0;
const core_1 = require("@aws-cdk/core");
const pipelines_1 = require("@aws-cdk/pipelines");
const codepipeline = require("@aws-cdk/aws-codepipeline");
const codepipeline_actions = require("@aws-cdk/aws-codepipeline-actions");
const infrastructure_stack_1 = require("./infrastructure-stack");
const aws_sdk_1 = require("aws-sdk");
const aws_iam_1 = require("@aws-cdk/aws-iam");
class InfrastructureStage extends core_1.Stage {
    constructor(scope, id, props) {
        super(scope, id, props);
        const { loadBalancer } = new infrastructure_stack_1.InfrastructureStack(this, "InfrastructureStack", props);
        this.loadBalancerAddress = new core_1.CfnOutput(loadBalancer, "LbAddress", {
            value: `http://${loadBalancer.loadBalancerDnsName}/`,
        });
    }
}
exports.InfrastructureStage = InfrastructureStage;
class PipelineStack extends core_1.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const sourceArtifact = new codepipeline.Artifact();
        const cloudAssemblyArtifact = new codepipeline.Artifact();
        const pipeline = new pipelines_1.CdkPipeline(this, "Pipeline", {
            pipelineName: "MyAppPipeline",
            selfMutating: false,
            cloudAssemblyArtifact,
            sourceAction: new codepipeline_actions.GitHubSourceAction({
                actionName: "GitHub",
                output: sourceArtifact,
                owner: this.node.tryGetContext("github_alias"),
                repo: this.node.tryGetContext("github_repo_name"),
                branch: this.node.tryGetContext("github_repo_branch"),
                oauthToken: core_1.SecretValue.secretsManager("GITHUB_TOKEN"),
            }),
            synthAction: pipelines_1.SimpleSynthAction.standardNpmSynth({
                sourceArtifact,
                cloudAssemblyArtifact,
                subdirectory: "source/3-landing-page-cicd/cdk",
                installCommand: "npm install",
                buildCommand: "npm run build",
                rolePolicyStatements: [
                    new aws_iam_1.PolicyStatement({
                        actions: ["organizations:ListAccounts"],
                        resources: ["*"],
                    }),
                ],
            }),
        });
        const AWS_PROFILE = "cicd";
        if (!process.env.CODEBUILD_BUILD_ID) {
            aws_sdk_1.config.credentials = new aws_sdk_1.SharedIniFileCredentials({
                profile: AWS_PROFILE,
            });
        }
        (async () => {
            try {
                const orders = { Staging: 1, Prod: 2 };
                const orgs = new aws_sdk_1.Organizations({ region: "us-east-1" });
                const { Accounts = [] } = await orgs.listAccounts().promise();
                Accounts.map((account) => ({
                    ...account,
                    order: orders[account.Name],
                }))
                    .sort((a, b) => a.order - b.order)
                    .forEach((account) => {
                    const infraStage = new InfrastructureStage(this, account.Name, {
                        env: { account: account.Id },
                    });
                    const applicationStage = pipeline.addApplicationStage(infraStage, {
                        manualApprovals: account.Name === "Prod",
                    });
                    applicationStage.addActions(new pipelines_1.ShellScriptAction({
                        actionName: "IntegrationTesting",
                        commands: ["curl -Ssf $URL/info.php"],
                        useOutputs: {
                            URL: pipeline.stackOutput(infraStage.loadBalancerAddress),
                        },
                    }));
                });
            }
            catch (error) {
                const messages = {
                    CredentialsError: `Failed to get credentials for "${AWS_PROFILE}" profile. Make sure to run "aws configure sso --profile ${AWS_PROFILE} && aws sso login --profile ${AWS_PROFILE}"\n\n`,
                    ExpiredTokenException: `Token expired, run "aws sso login --profile ${AWS_PROFILE}"\n\n`,
                    AccessDeniedException: `Unable to call the AWS Organizations ListAccounts API. Make sure to add a PolicyStatement with the organizations:ListAccounts action to your synth action`,
                };
                const message = messages[error.code];
                message
                    ? console.error("\x1b[31m", message)
                    : console.error(error.message);
                //force CDK to fail in case of an unknown exception
                process.exit(1);
            }
        })();
    }
}
exports.PipelineStack = PipelineStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGlwZWxpbmUtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJwaXBlbGluZS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx3Q0FRdUI7QUFDdkIsa0RBSTRCO0FBQzVCLDBEQUEwRDtBQUMxRCwwRUFBMEU7QUFDMUUsaUVBQTZEO0FBQzdELHFDQUEwRTtBQUMxRSw4Q0FBbUQ7QUFFbkQsTUFBYSxtQkFBb0IsU0FBUSxZQUFLO0lBRTVDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBa0I7UUFDMUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDeEIsTUFBTSxFQUFFLFlBQVksRUFBRSxHQUFHLElBQUksMENBQW1CLENBQzlDLElBQUksRUFDSixxQkFBcUIsRUFDckIsS0FBSyxDQUNOLENBQUM7UUFDRixJQUFJLENBQUMsbUJBQW1CLEdBQUcsSUFBSSxnQkFBUyxDQUFDLFlBQVksRUFBRSxXQUFXLEVBQUU7WUFDbEUsS0FBSyxFQUFFLFVBQVUsWUFBWSxDQUFDLG1CQUFtQixHQUFHO1NBQ3JELENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQWJELGtEQWFDO0FBRUQsTUFBYSxhQUFjLFNBQVEsWUFBSztJQUN0QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQWtCO1FBQzFELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sY0FBYyxHQUFHLElBQUksWUFBWSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ25ELE1BQU0scUJBQXFCLEdBQUcsSUFBSSxZQUFZLENBQUMsUUFBUSxFQUFFLENBQUM7UUFFMUQsTUFBTSxRQUFRLEdBQUcsSUFBSSx1QkFBVyxDQUFDLElBQUksRUFBRSxVQUFVLEVBQUU7WUFDakQsWUFBWSxFQUFFLGVBQWU7WUFDN0IsWUFBWSxFQUFFLEtBQUs7WUFDbkIscUJBQXFCO1lBQ3JCLFlBQVksRUFB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QUFNLFFBQVEsR0FBUTtvQkFDcEIsZ0JBQWdCLEVBQUUsa0NBQWtDLFdBQVcsNERBQTRELFdBQVcsK0JBQStCLFdBQVcsT0FBTztvQkFDdkwscUJBQXFCLEVBQUUsK0NBQStDLFdBQVcsT0FBTztvQkFDeEYscUJBQXFCLEVBQUUsMkpBQTJKO2lCQUNuTCxDQUFDO2dCQUNGLE1BQU0sT0FBTyxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ3JDLE9BQU87b0JBQ0wsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLE9BQU8sQ0FBQztvQkFDcEMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUVqQyxtREFBbUQ7Z0JBQ25ELE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDakI7UUFDSCxDQUFDLENBQUMsRUFBRSxDQUFDO0lBQ1AsQ0FBQztDQUNGO0FBckZELHNDQXFGQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gIENvbnN0cnVjdCxcbiAgU3RhZ2UsXG4gIFN0YWNrLFxuICBTdGFja1Byb3BzLFxuICBTdGFnZVByb3BzLFxuICBTZWNyZXRWYWx1ZSxcbiAgQ2ZuT3V0cHV0LFxufSBmcm9tIFwiQGF3cy1jZGsvY29yZVwiO1xuaW1wb3J0IHtcbiAgQ2RrUGlwZWxpbmUsXG4gIFNpbXBsZVN5bnRoQWN0aW9uLFxuICBTaGVsbFNjcmlwdEFjdGlvbixcbn0gZnJvbSBcIkBhd3MtY2RrL3BpcGVsaW5lc1wiO1xuaW1wb3J0ICogYXMgY29kZXBpcGVsaW5lIGZyb20gXCJAYXdzLWNkay9hd3MtY29kZXBpcGVsaW5lXCI7XG5pbXBvcnQgKiBhcyBjb2RlcGlwZWxpbmVfYWN0aW9ucyBmcm9tIFwiQGF3cy1jZGsvYXdzLWNvZGVwaXBlbGluZS1hY3Rpb25zXCI7XG5pbXBvcnQgeyBJbmZyYXN0cnVjdHVyZVN0YWNrIH0gZnJvbSBcIi4vaW5mcmFzdHJ1Y3R1cmUtc3RhY2tcIjtcbmltcG9ydCB7IGNvbmZpZywgU2hhcmVkSW5pRmlsZUNyZWRlbnRpYWxzLCBPcmdhbml6YXRpb25zIH0gZnJvbSBcImF3cy1zZGtcIjtcbmltcG9ydCB7IFBvbGljeVN0YXRlbWVudCB9IGZyb20gXCJAYXdzLWNkay9hd3MtaWFtXCI7XG5cbmV4cG9ydCBjbGFzcyBJbmZyYXN0cnVjdHVyZVN0YWdlIGV4dGVuZHMgU3RhZ2Uge1xuICBwdWJsaWMgcmVhZG9ubHkgbG9hZEJhbGFuY2VyQWRkcmVzczogQ2ZuT3V0cHV0O1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IFN0YWdlUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcbiAgICBjb25zdCB7IGxvYWRCYWxhbmNlciB9ID0gbmV3IEluZnJhc3RydWN0dXJlU3RhY2soXG4gICAgICB0aGlzLFxuICAgICAgXCJJbmZyYXN0cnVjdHVyZVN0YWNrXCIsXG4gICAgICBwcm9wc1xuICAgICk7XG4gICAgdGhpcy5sb2FkQmFsYW5jZXJBZGRyZXNzID0gbmV3IENmbk91dHB1dChsb2FkQmFsYW5jZXIsIFwiTGJBZGRyZXNzXCIsIHtcbiAgICAgIHZhbHVlOiBgaHR0cDovLyR7bG9hZEJhbGFuY2VyLmxvYWRCYWxhbmNlckRuc05hbWV9L2AsXG4gICAgfSk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFBpcGVsaW5lU3RhY2sgZXh0ZW5kcyBTdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3Qgc291cmNlQXJ0aWZhY3QgPSBuZXcgY29kZXBpcGVsaW5lLkFydGlmYWN0KCk7XG4gICAgY29uc3QgY2xvdWRBc3NlbWJseUFydGlmYWN0ID0gbmV3IGNvZGVwaXBlbGluZS5BcnRpZmFjdCgpO1xuXG4gICAgY29uc3QgcGlwZWxpbmUgPSBuZXcgQ2RrUGlwZWxpbmUodGhpcywgXCJQaXBlbGluZVwiLCB7XG4gICAgICBwaXBlbGluZU5hbWU6IFwiTXlBcHBQaXBlbGluZVwiLFxuICAgICAgc2VsZk11dGF0aW5nOiBmYWxzZSxcbiAgICAgIGNsb3VkQXNzZW1ibHlBcnRpZmFjdCxcbiAgICAgIHNvdXJjZUFjdGlvbjogbmV3IGNvZGVwaXBlbGluZV9hY3Rpb25zLkdpdEh1YlNvdXJjZUFjdGlvbih7XG4gICAgICAgIGFjdGlvbk5hbWU6IFwiR2l0SHViXCIsXG4gICAgICAgIG91dHB1dDogc291cmNlQXJ0aWZhY3QsXG4gICAgICAgIG93bmVyOiB0aGlzLm5vZGUudHJ5R2V0Q29udGV4dChcImdpdGh1Yl9hbGlhc1wiKSxcbiAgICAgICAgcmVwbzogdGhpcy5ub2RlLnRyeUdldENvbnRleHQoXCJnaXRodWJfcmVwb19uYW1lXCIpLFxuICAgICAgICBicmFuY2g6IHRoaXMubm9kZS50cnlHZXRDb250ZXh0KFwiZ2l0aHViX3JlcG9fYnJhbmNoXCIpLFxuICAgICAgICBvYXV0aFRva2VuOiBTZWNyZXRWYWx1ZS5zZWNyZXRzTWFuYWdlcihcIkdJVEhVQl9UT0tFTlwiKSxcbiAgICAgIH0pLFxuICAgICAgc3ludGhBY3Rpb246IFNpbXBsZVN5bnRoQWN0aW9uLnN0YW5kYXJkTnBtU3ludGgoe1xuICAgICAgICBzb3VyY2VBcnRpZmFjdCxcbiAgICAgICAgY2xvdWRBc3NlbWJseUFydGlmYWN0LFxuICAgICAgICBzdWJkaXJlY3Rvcnk6IFwic291cmNlLzMtbGFuZGluZy1wYWdlLWNpY2QvY2RrXCIsXG4gICAgICAgIGluc3RhbGxDb21tYW5kOiBcIm5wbSBpbnN0YWxsXCIsXG4gICAgICAgIGJ1aWxkQ29tbWFuZDogXCJucG0gcnVuIGJ1aWxkXCIsXG4gICAgICAgIHJvbGVQb2xpY3lTdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgbmV3IFBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICBhY3Rpb25zOiBbXCJvcmdhbml6YXRpb25zOkxpc3RBY2NvdW50c1wiXSxcbiAgICAgICAgICAgIHJlc291cmNlczogW1wiKlwiXSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSxcbiAgICAgIH0pLFxuICAgIH0pO1xuXG4gICAgY29uc3QgQVdTX1BST0ZJTEUgPSBcImNpY2RcIjtcbiAgICBpZiAoIXByb2Nlc3MuZW52LkNPREVCVUlMRF9CVUlMRF9JRCkge1xuICAgICAgY29uZmlnLmNyZWRlbnRpYWxzID0gbmV3IFNoYXJlZEluaUZpbGVDcmVkZW50aWFscyh7XG4gICAgICAgIHByb2ZpbGU6IEFXU19QUk9GSUxFLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgKGFzeW5jICgpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IG9yZGVyczogYW55ID0geyBTdGFnaW5nOiAxLCBQcm9kOiAyIH07XG4gICAgICAgIGNvbnN0IG9yZ3MgPSBuZXcgT3JnYW5pemF0aW9ucyh7IHJlZ2lvbjogXCJ1cy1lYXN0LTFcIiB9KTtcbiAgICAgICAgY29uc3QgeyBBY2NvdW50cyA9IFtdIH0gPSBhd2FpdCBvcmdzLmxpc3RBY2NvdW50cygpLnByb21pc2UoKTtcblxuICAgICAgICBBY2NvdW50cy5tYXAoKGFjY291bnQpID0+ICh7XG4gICAgICAgICAgLi4uYWNjb3VudCxcbiAgICAgICAgICBvcmRlcjogb3JkZXJzW2FjY291bnQuTmFtZSFdLFxuICAgICAgICB9KSlcbiAgICAgICAgICAuc29ydCgoYSwgYikgPT4gYS5vcmRlciAtIGIub3JkZXIpXG4gICAgICAgICAgLmZvckVhY2goKGFjY291bnQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGluZnJhU3RhZ2UgPSBuZXcgSW5mcmFzdHJ1Y3R1cmVTdGFnZSh0aGlzLCBhY2NvdW50Lk5hbWUhLCB7XG4gICAgICAgICAgICAgIGVudjogeyBhY2NvdW50OiBhY2NvdW50LklkIH0sXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbnN0IGFwcGxpY2F0aW9uU3RhZ2UgPSBwaXBlbGluZS5hZGRBcHBsaWNhdGlvblN0YWdlKGluZnJhU3RhZ2UsIHtcbiAgICAgICAgICAgICAgbWFudWFsQXBwcm92YWxzOiBhY2NvdW50Lk5hbWUgPT09IFwiUHJvZFwiLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBhcHBsaWNhdGlvblN0YWdlLmFkZEFjdGlvbnMoXG4gICAgICAgICAgICAgIG5ldyBTaGVsbFNjcmlwdEFjdGlvbih7XG4gICAgICAgICAgICAgICAgYWN0aW9uTmFtZTogXCJJbnRlZ3JhdGlvblRlc3RpbmdcIixcbiAgICAgICAgICAgICAgICBjb21tYW5kczogW1wiY3VybCAtU3NmICRVUkwvaW5mby5waHBcIl0sXG4gICAgICAgICAgICAgICAgdXNlT3V0cHV0czoge1xuICAgICAgICAgICAgICAgICAgVVJMOiBwaXBlbGluZS5zdGFja091dHB1dChpbmZyYVN0YWdlLmxvYWRCYWxhbmNlckFkZHJlc3MpLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH0pO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc3QgbWVzc2FnZXM6IGFueSA9IHtcbiAgICAgICAgICBDcmVkZW50aWFsc0Vycm9yOiBgRmFpbGVkIHRvIGdldCBjcmVkZW50aWFscyBmb3IgXCIke0FXU19QUk9GSUxFfVwiIHByb2ZpbGUuIE1ha2Ugc3VyZSB0byBydW4gXCJhd3MgY29uZmlndXJlIHNzbyAtLXByb2ZpbGUgJHtBV1NfUFJPRklMRX0gJiYgYXdzIHNzbyBsb2dpbiAtLXByb2ZpbGUgJHtBV1NfUFJPRklMRX1cIlxcblxcbmAsXG4gICAgICAgICAgRXhwaXJlZFRva2VuRXhjZXB0aW9uOiBgVG9rZW4gZXhwaXJlZCwgcnVuIFwiYXdzIHNzbyBsb2dpbiAtLXByb2ZpbGUgJHtBV1NfUFJPRklMRX1cIlxcblxcbmAsXG4gICAgICAgICAgQWNjZXNzRGVuaWVkRXhjZXB0aW9uOiBgVW5hYmxlIHRvIGNhbGwgdGhlIEFXUyBPcmdhbml6YXRpb25zIExpc3RBY2NvdW50cyBBUEkuIE1ha2Ugc3VyZSB0byBhZGQgYSBQb2xpY3lTdGF0ZW1lbnQgd2l0aCB0aGUgb3JnYW5pemF0aW9uczpMaXN0QWNjb3VudHMgYWN0aW9uIHRvIHlvdXIgc3ludGggYWN0aW9uYCxcbiAgICAgICAgfTtcbiAgICAgICAgY29uc3QgbWVzc2FnZSA9IG1lc3NhZ2VzW2Vycm9yLmNvZGVdO1xuICAgICAgICBtZXNzYWdlXG4gICAgICAgICAgPyBjb25zb2xlLmVycm9yKFwiXFx4MWJbMzFtXCIsIG1lc3NhZ2UpXG4gICAgICAgICAgOiBjb25zb2xlLmVycm9yKGVycm9yLm1lc3NhZ2UpO1xuXG4gICAgICAgIC8vZm9yY2UgQ0RLIHRvIGZhaWwgaW4gY2FzZSBvZiBhbiB1bmtub3duIGV4Y2VwdGlvblxuICAgICAgICBwcm9jZXNzLmV4aXQoMSk7XG4gICAgICB9XG4gICAgfSkoKTtcbiAgfVxufVxuIl19