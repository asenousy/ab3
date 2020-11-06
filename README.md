# Fullstack Ecommerce CDK APP With CICD

This demonstrate an example of CDK being used for SDLC, what the CDK App builds:

1. CICD Pipeline Stack
2. Ecommerce App Infrastructure Stack

## CICD Pipeline Stack

The pipeline created consists of several stages:

1. fetching code from repository
2. building the code
3. deployment stage: deploying the Ecommerce Infrastructure using CDK along with deployment of App

## Ecommerce App Stack

- Cloud Front Distribution for S3 Bucket storing image assets
- Aurora Serverless with MySQL Engine for products details
- Fargate for serverless ECS to run our dockerized App
- A simple PHP App container with NGINX proxy container

## Steps

1. fork the repository on your Github account by clicking here
1. fill your AWS credentials and github details in cdk.json
1. npm install
1. npm run build - to transpile typescript
1. npm run synth - to create cloudFormation template
1. npm run deploy - to deploy

### Note:

Be aware that there are 2 layers of CDK Code, one which you deployed locally that only sets up the pipeline, the second one is used by the pipeline to set up the App's Infrastucture
