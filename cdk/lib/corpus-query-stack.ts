/**
 * CDK stack for CorpusQuery - Paper QA on AWS.
 * Deploys DynamoDB, Lambda functions, and API Gateway for the "ask" slice.
 */
import * as path from "path";
import * as os from "os";
import {
  Stack,
  StackProps,
  Duration,
  RemovalPolicy,
  CfnOutput,
  CfnResource,
  aws_dynamodb as dynamodb,
  aws_lambda as lambda,
  aws_iam as iam,
  aws_apigateway as apigw,
  aws_logs as logs,
  aws_s3 as s3,
  aws_bedrock as bedrock,
  aws_cognito as cognito,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as amplify from "@aws-cdk/aws-amplify-alpha";

const APP_NAME = "corpus-query";

export class CorpusQueryStack extends Stack {
  private readonly backendRoot = path.join(__dirname, "../../backend");

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const commonEnv: Record<string, string> = {
      LOG_LEVEL: process.env.LOG_LEVEL || "INFO",
    };

    // DynamoDB Table
    const sessionsTable = new dynamodb.Table(this, "SessionsAndChatHistory", {
      tableName: `${APP_NAME}-sessions-and-chat-history`,
      partitionKey: {
        name: "user_id",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "sk",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    // GSI for session pagination by last_active
    sessionsTable.addGlobalSecondaryIndex({
      indexName: 'user-sessions-by-last-active',
      partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'last_active', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Amplify Hosting for Frontend (defined early for S3 CORS reference)
    const amplifyApp = new amplify.App(this, "FrontendApp", {
      appName: `${APP_NAME}-frontend`,
      platform: amplify.Platform.WEB,
      customRules: [
        {
          source:
            "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json)$)([^.]+$)/>",
          target: "/index.html",
          status: amplify.RedirectStatus.REWRITE,
        },
      ],
    });

    const amplifyBranch = amplifyApp.addBranch("main", {
      autoBuild: false,
      stage: "PRODUCTION",
    });

    // S3 Bucket for paper uploads
    // const corsOrigins = [
    //   `https://main.${amplifyApp.appId}.amplifyapp.com`,
    //   ...(process.env.ALLOW_LOCALHOST === "true" ? ["http://localhost:5173"] : []),
    // ];


    const corsOrigins = process.env.ALLOW_LOCALHOST == "true" ? ["http://localhost:5173"]
    : [`https://main.${amplifyApp.appId}.amplifyapp.com`]

    const papersBucket = new s3.Bucket(this, "PapersBucket", {
      bucketName: `${APP_NAME}-papers-${this.account}`,
      removalPolicy: RemovalPolicy.RETAIN,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: corsOrigins,
          allowedHeaders: ["Content-Type"],
          maxAge: 3000,
        },
      ],
    });


    const fetchedBucket = new s3.Bucket(this, "FetchedBucket", {
      bucketName: `${APP_NAME}-papers-fetched-${this.account}`,
      removalPolicy: RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
                {
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: corsOrigins,
          allowedHeaders: ["Content-Type"],
          maxAge: 3000,
        },
      ]
    });

    // S3 Vectors bucket for embeddings
    const vectorBucket = new CfnResource(this, "VectorBucket", {
      type: "AWS::S3Vectors::VectorBucket",
      properties: {
        VectorBucketName: `${APP_NAME}-vectors-${this.account}`,
      },
    });

    // S3 Vectors index with Bedrock KB metadata configuration
    const vectorIndex = new CfnResource(this, "VectorIndex", {
      type: "AWS::S3Vectors::Index",
      properties: {
        VectorBucketArn: vectorBucket.getAtt("VectorBucketArn"),
        IndexName: "papers",
        DataType: "float32",
        Dimension: 1024,
        DistanceMetric: "cosine",
        MetadataConfiguration: {
          NonFilterableMetadataKeys: [
            "AMAZON_BEDROCK_TEXT",
            "AMAZON_BEDROCK_METADATA",
          ],
        },
      },
    });

    // Bedrock Knowledge Base service role
    const kbRole = new iam.Role(this, "BedrockKBRole", {
      assumedBy: new iam.ServicePrincipal("bedrock.amazonaws.com"),
      inlinePolicies: {
        BedrockKBPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ["s3:GetObject", "s3:ListBucket"],
              resources: [papersBucket.bucketArn, `${papersBucket.bucketArn}/*`,
                fetchedBucket.bucketArn, `${fetchedBucket.bucketArn}/*`,
              ],
            }),
            new iam.PolicyStatement({
              actions: [
                "s3vectors:PutVectors",
                "s3vectors:DeleteVectors",
                "s3vectors:ListVectors",
                "s3vectors:GetVectors",
                "s3vectors:QueryVectors",
              ],
              resources: [
                vectorBucket.getAtt("VectorBucketArn").toString() + "/*",
              ],
            }),
            new iam.PolicyStatement({
              actions: ["bedrock:InvokeModel"],
              resources: [
                `arn:aws:bedrock:${this.region}::foundation-model/amazon.titan-embed-text-v2:0`,
              ],
            }),
            new iam.PolicyStatement({
              actions: ["bedrock:InvokeDataAutomationAsync"],
              resources: [
                `arn:aws:bedrock:*:aws:data-automation-project/public-rag-default`,
                `arn:aws:bedrock:*:${this.account}:data-automation-profile/*`,
              ],
            }),
            new iam.PolicyStatement({
              actions: ["bedrock:GetDataAutomationStatus"],
              resources: [
                `arn:aws:bedrock:*:${this.account}:data-automation-invocation/*`,
              ],
            }),
          ],
        }),
      },
    });

    // Bedrock Knowledge Base
    const knowledgeBase = new bedrock.CfnKnowledgeBase(this, "KnowledgeBase", {
      name: `${APP_NAME}-papers`,
      description: "Scientific papers for CorpusQuery",
      roleArn: kbRole.roleArn,
      knowledgeBaseConfiguration: {
        type: "VECTOR",
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: `arn:aws:bedrock:${this.region}::foundation-model/amazon.titan-embed-text-v2:0`,
        },
      },
      storageConfiguration: {
        type: "S3_VECTORS",
        s3VectorsConfiguration: {
          vectorBucketArn: vectorBucket.getAtt("VectorBucketArn").toString(),
          indexArn: vectorIndex.getAtt("IndexArn").toString(),
        },
      },
    });

    // Bedrock Data Source with Bedrock Data Automation parser
    const dataSource = new bedrock.CfnDataSource(this, "PapersDataSource", {
      name: "papers-s3",
      knowledgeBaseId: knowledgeBase.attrKnowledgeBaseId,
      dataSourceConfiguration: {
        type: "S3",
        s3Configuration: {
          bucketArn: papersBucket.bucketArn,
          inclusionPrefixes: ["papers/"],
        },
      },
      vectorIngestionConfiguration: {
        chunkingConfiguration: {
          chunkingStrategy: "FIXED_SIZE",
          fixedSizeChunkingConfiguration: {
            maxTokens: 512,
            overlapPercentage: 15,
          },
        },
        parsingConfiguration: {
          parsingStrategy: "BEDROCK_DATA_AUTOMATION",
        },
      },
    });


    const fetchedDataSource = new bedrock.CfnDataSource(this, "FetchedDataSource", {
      name: "fetched-papers-s3",
      knowledgeBaseId: knowledgeBase.attrKnowledgeBaseId,
      dataSourceConfiguration: {
        type: "S3",
        s3Configuration: {
          bucketArn: fetchedBucket.bucketArn,
          inclusionPrefixes: ["fetched-papers/"],
        },
      },
      vectorIngestionConfiguration: {
        chunkingConfiguration: {
          chunkingStrategy: "FIXED_SIZE",
          fixedSizeChunkingConfiguration: {
            maxTokens: 512,
            overlapPercentage: 15,
          },
        },
        parsingConfiguration: {
          parsingStrategy: "BEDROCK_DATA_AUTOMATION",
        },
      },
    });

    // Cognito User Pool
    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: `${APP_NAME}-users`,
      selfSignUpEnabled: false,
      signInAliases: { email: true, username: true },
      autoVerify: { email: true },
      standardAttributes: {
        givenName: { required: true, mutable: true },
        familyName: { required: true, mutable: true },
        email: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      userInvitation: {
        emailSubject: "Your CorpusQuery account",
        emailBody:
          "You have been invited to CorpusQuery. Your username is {username} and temporary password is {####}",
      },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const userPoolClient = new cognito.UserPoolClient(this, "UserPoolClient", {
      userPool,
      userPoolClientName: `${APP_NAME}-web-client`,
      generateSecret: false,
      authFlows: {
        userSrp: true,
        userPassword: true,
      },
      oAuth: {
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
      },
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
    });

    // NOTE: Lambda Layer approach abandoned - paper-qa is too large (>250MB unzipped)
    // Both Query and Indexer bundle paper-qa directly (duplication is okay, both stay under limit)

    // Query Lambda
    const queryLambda = this.createLambdaFunction({
      functionName: "query",
      handler: "handler.handler",
      description: "Executes paper-qa queries and stores results",
      memorySize: 2048,
      timeout: Duration.minutes(5),
      additionalDeps: ["./vectorstore", "./shared"],
      additionalEnv: {
        ...commonEnv,
        SESSIONS_AND_CHAT_HISTORY_TABLE_NAME: sessionsTable.tableName,
        VECTOR_BUCKET: `${APP_NAME}-vectors-${this.account}`,
        VECTOR_INDEX: "papers",
        PQA_HOME: "/tmp",
      },
    });

    sessionsTable.grantReadWriteData(queryLambda);

    // Bedrock permissions for Query Lambda
    queryLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: [
          "arn:aws:bedrock:*::foundation-model/amazon.titan-embed-text-v2:0",
          "arn:aws:bedrock:*::foundation-model/anthropic.claude-*",
          `arn:aws:bedrock:*:${this.account}:inference-profile/us.anthropic.claude-*`,
        ],
      })
    );

    // S3 Vectors permissions for Query Lambda
    queryLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "s3vectors:QueryVectors",
          "s3vectors:GetVectors",
          "s3vectors:ListVectors",
        ],
        resources: [
          `arn:aws:s3vectors:${this.region}:${this.account}:bucket/${APP_NAME}-vectors-${this.account}/*`,
        ],
      })
    );

    // SSM Parameter Store permissions for Query Lambda (user settings)
    queryLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter/corpus-query/*`,
        ],
      })
    );

    // Secrets Manager permissions for Query Lambda (user API keys for non-Bedrock providers)
    queryLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["secretsmanager:GetSecretValue"],
        resources: [
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:/corpus-query/*`,
        ],
      })
    );


    // FETCHER LAMBDA

    const fetcherLambda = new lambda.Function(this, 'fetcherLambda', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'handler.handler',
      environment: {
        BUCKET_NAME : fetchedBucket.bucketName,
        SESSIONS_AND_CHAT_HISTORY_TABLE_NAME: sessionsTable.tableName,
        // INDEXER_FUNCTION_NAME: indexerLambda.functionName added after indexerLambda created

      },
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../../backend'),
        {
          bundling: {
            image: lambda.Runtime.PYTHON_3_11.bundlingImage,
            command: [
              'bash', '-c',
              'pip install -r /asset-input/lambdas/fetcher/requirements.txt -t /asset-output --no-cache-dir && ' +
              'cp -r /asset-input/lambdas/fetcher/*.py /asset-output/ && ' +
              'cp -r /asset-input/shared/src/shared /asset-output/',
            ],
          },
        }
      ),
      timeout: Duration.minutes(15),
      memorySize: 1024,
    });

    fetchedBucket.grantReadWrite(fetcherLambda);

    const indexerLambda = this.createLambdaFunction({
        functionName: "indexer",
        handler: "handler.handler",
        description: "Indexes fetched papers into S3 Vectors",
        memorySize: 3008,  // More memory for PDF processing
        timeout: Duration.minutes(15),
        additionalDeps: ["./shared"],
        additionalEnv: {
          FETCHED_BUCKET_NAME: fetchedBucket.bucketName,
          VECTOR_BUCKET: `${APP_NAME}-vectors-${this.account}`,
          VECTOR_INDEX: "papers",  // ← Use same index with ORCID filtering
          SESSIONS_AND_CHAT_HISTORY_TABLE_NAME: sessionsTable.tableName,
        },
      });

    sessionsTable.grantReadWriteData(indexerLambda);

    indexerLambda.grantInvoke(fetcherLambda);
    fetchedBucket.grantRead(indexerLambda);
    papersBucket.grantRead(indexerLambda);

    indexerLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3vectors:PutVectors"],
        resources: [
          `arn:aws:s3vectors:${this.region}:${this.account}:bucket/${APP_NAME}-vectors-${this.account}/*`,
        ],
      })
    );

    indexerLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: [
          `arn:aws:bedrock:${this.region}::foundation-model/amazon.titan-embed-text-v2:0`,
        ],
      })
    );

    fetcherLambda.addEnvironment('INDEXER_FUNCTION_NAME', indexerLambda.functionName);

    // Secrets Manager permissions for Fetcher Lambda (user API keys e.g. OPENALEX_API_KEY)
    fetcherLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["secretsmanager:GetSecretValue"],
        resources: [
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:/corpus-query/*`,
        ],
      })
    );


    // API Lambda
    const apiLambda = this.createLambdaFunction({
      functionName: "api",
      handler: "handler.handler",
      description: "Handles API requests for CorpusQuery",
      memorySize: 256,
      timeout: Duration.seconds(30),
      additionalDeps: ["./shared"],
      additionalEnv: {
        ...commonEnv,
        SESSIONS_AND_CHAT_HISTORY_TABLE_NAME: sessionsTable.tableName,
        QUERY_FUNCTION_NAME: queryLambda.functionName,
        FETCHER_FUNCTION_NAME: fetcherLambda.functionName,
        PAPERS_BUCKET_NAME: papersBucket.bucketName,
        FETCHED_BUCKET_NAME: fetchedBucket.bucketName,
        KNOWLEDGE_BASE_ID: knowledgeBase.attrKnowledgeBaseId,
        DATA_SOURCE_ID: dataSource.attrDataSourceId,
        FETCHED_DATA_SOURCE_ID: fetchedDataSource.attrDataSourceId,
        VECTOR_BUCKET: `${APP_NAME}-vectors-${this.account}`,
        VECTOR_INDEX: "papers",
      },
    });

    sessionsTable.grantReadWriteData(apiLambda);
    queryLambda.grantInvoke(apiLambda);
    fetcherLambda.grantInvoke(apiLambda);
    indexerLambda.grantInvoke(apiLambda);
    fetchedBucket.grantRead(apiLambda);
    apiLambda.addEnvironment('INDEXER_FUNCTION_NAME', indexerLambda.functionName);

    // SSM Parameter Store permissions for API Lambda
    apiLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter", "ssm:PutParameter"],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter/corpus-query/*`,
        ],
      })
    );

    // Secrets Manager permissions for API Lambda
    apiLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "secretsmanager:GetSecretValue",
          "secretsmanager:CreateSecret",
          "secretsmanager:PutSecretValue",
          "secretsmanager:DescribeSecret",
        ],
        resources: [
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:/corpus-query/*`,
        ],
      })
    );

    // S3 permissions for document upload
    apiLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:ListBucket"],
        resources: [papersBucket.bucketArn, fetchedBucket.bucketArn],
      })
    );

    apiLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:PutObject","s3:GetObject"],
        resources: [`${papersBucket.bucketArn}/*`, `${fetchedBucket.bucketArn}/*`],
      })
    );

    // Bedrock Agent permissions for document sync and listing
    apiLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "bedrock:StartIngestionJob",
          "bedrock:GetIngestionJob",
          "bedrock:ListKnowledgeBaseDocuments",
          "bedrock:ListIngestionJobs",
        ],
        resources: [
          `arn:aws:bedrock:${this.region}:${this.account}:knowledge-base/${knowledgeBase.attrKnowledgeBaseId}`,
          `arn:aws:bedrock:${this.region}:${this.account}:knowledge-base/${knowledgeBase.attrKnowledgeBaseId}/datasource/${dataSource.attrDataSourceId}`,
          `arn:aws:bedrock:${this.region}:${this.account}:knowledge-base/${knowledgeBase.attrKnowledgeBaseId}/datasource/${fetchedDataSource.attrDataSourceId}`,
        ],
      })
    );

    sessionsTable.grantReadWriteData(fetcherLambda)

    // API Gateway
    const api = new apigw.RestApi(this, "CorpusQueryApi", {
      restApiName: "CorpusQuery API",
      description: "API for CorpusQuery paper-qa chatbot",
      defaultCorsPreflightOptions: {
        allowOrigins: corsOrigins,
        allowMethods: apigw.Cors.ALL_METHODS,
        allowHeaders: [
          "Content-Type",
          "X-Amz-Date",
          "Authorization",
          "X-Api-Key",
          "X-Amz-Security-Token",
        ],
        maxAge: Duration.seconds(300),
      },
    });

    const cognitoAuthorizer = new apigw.CognitoUserPoolsAuthorizer(
      this,
      "CognitoAuthorizer",
      {
        cognitoUserPools: [userPool],
        authorizerName: `${APP_NAME}-authorizer`,
      }
    );

    const authMethodOptions: apigw.MethodOptions = {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
    };

    // Use IAM credentials role so API Gateway never touches the Lambda resource policy.
    // This avoids the 20KB Lambda resource policy limit entirely.
    const apiGatewayRole = new iam.Role(this, 'ApiGatewayLambdaRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
    });
    apiLambda.grantInvoke(apiGatewayRole);

    const apiIntegration = new apigw.LambdaIntegration(apiLambda, {
      allowTestInvoke: false,
      credentialsRole: apiGatewayRole,
    });

    // Health check (unauthenticated)
    const healthResource = api.root.addResource("health");
    healthResource.addMethod("GET", apiIntegration);

    // POST /ask (authenticated)
    const askResource = api.root.addResource("ask");
    askResource.addMethod("POST", apiIntegration, authMethodOptions);

    // GET /jobs/{jobId} (authenticated)
    const jobsResource = api.root.addResource("jobs");
    const jobResource = jobsResource.addResource("{jobId}");
    jobResource.addMethod("GET", apiIntegration, authMethodOptions);

    // Sessions routes (authenticated)
    const sessionsResource = api.root.addResource("sessions");
    sessionsResource.addMethod("GET", apiIntegration, authMethodOptions);

    const sessionResource = sessionsResource.addResource("{sessionId}");
    sessionResource.addMethod("PUT", apiIntegration, authMethodOptions);
    sessionResource.addMethod("DELETE", apiIntegration, authMethodOptions);

    const messagesResource = sessionResource.addResource("messages");
    messagesResource.addMethod("GET", apiIntegration, authMethodOptions);

    // Settings routes (authenticated)
    const settingsResource = api.root.addResource("settings");
    settingsResource.addMethod("GET", apiIntegration, authMethodOptions);
    settingsResource.addMethod("PUT", apiIntegration, authMethodOptions);

    const secretsResource = settingsResource.addResource("secrets");
    secretsResource.addMethod("PUT", apiIntegration, authMethodOptions);

    const secretsStatusResource = secretsResource.addResource("status");
    secretsStatusResource.addMethod("GET", apiIntegration, authMethodOptions);

    // Documents routes (authenticated)
    const documentsResource = api.root.addResource("documents");
    documentsResource.addMethod("GET", apiIntegration, authMethodOptions);

    const uploadUrlsResource = documentsResource.addResource("upload-urls");
    uploadUrlsResource.addMethod("POST", apiIntegration, authMethodOptions);

    const indexResource = documentsResource.addResource("index");
    indexResource.addMethod("POST", apiIntegration, authMethodOptions);

    const fetchedDocsResource = documentsResource.addResource("fetched");
    fetchedDocsResource.addMethod("GET", apiIntegration, authMethodOptions);

    const researchersResource = documentsResource.addResource("researchers");
    researchersResource.addMethod("GET", apiIntegration, authMethodOptions);

    const syncResource = documentsResource.addResource("sync");
    syncResource.addMethod("POST", apiIntegration, authMethodOptions);

    const syncJobsResource = documentsResource.addResource("sync-jobs");
    syncJobsResource.addMethod("GET", apiIntegration, authMethodOptions);

    const syncJobResource = syncJobsResource.addResource("{jobId}");
    syncJobResource.addMethod("GET", apiIntegration, authMethodOptions);

    const documentDownloadResource = documentsResource.addResource("download");
    documentDownloadResource.addMethod("GET", apiIntegration, authMethodOptions);

    // Fetcher routes (authenticated)
    const fetcherResource = api.root.addResource("fetcher");
    fetcherResource.addMethod("POST", apiIntegration, authMethodOptions);

    const fetcherJobsResource = api.root.addResource("fetcher-jobs");
    const fetcherJobResource = fetcherJobsResource.addResource("{jobId}");
    fetcherJobsResource.addMethod("GET", apiIntegration, authMethodOptions);
    fetcherJobResource.addMethod("GET", apiIntegration, authMethodOptions);


    // Outputs
    new CfnOutput(this, "ApiUrl", {
      value: api.url,
      description: "API Gateway URL",
    });
    new CfnOutput(this, "SessionsTableName", {
      value: sessionsTable.tableName,
      description: "DynamoDB table name",
    });
    new CfnOutput(this, "ApiLambdaName", {
      value: apiLambda.functionName,
      description: "API Lambda function name",
    });
    new CfnOutput(this, "QueryLambdaName", {
      value: queryLambda.functionName,
      description: "Query Lambda function name",
    });
    new CfnOutput(this, "IndexerLambdaName", {
      value: indexerLambda.functionName,
      description: "Indexer Lambda function name",
    });
    new CfnOutput(this, "FetcherLambdaName", {
      value: fetcherLambda.functionName,
      description: "Fetcher Lambda function name",
    });
    new CfnOutput(this, "PapersBucketName", {
      value: papersBucket.bucketName,
      description: "S3 bucket for paper uploads",
    });
    new CfnOutput(this, "FetchedPapersBucketName", {
      value: fetchedBucket.bucketName,
      description: "S3 bucket for fetched papers (ORCID)",
    });
    new CfnOutput(this, "KnowledgeBaseId", {
      value: knowledgeBase.attrKnowledgeBaseId,
      description: "Bedrock Knowledge Base ID for manual sync",
    });
    new CfnOutput(this, "DataSourceId", {
      value: dataSource.attrDataSourceId,
      description: "Data Source ID for sync operations",
    });
    new CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId,
      description: "Cognito User Pool ID",
    });
    new CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
      description: "Cognito User Pool Client ID",
    });
    new CfnOutput(this, "AmplifyAppId", {
      value: amplifyApp.appId,
      description: "Amplify App ID",
    });
    new CfnOutput(this, "AmplifyAppUrl", {
      value: `https://main.${amplifyApp.appId}.amplifyapp.com`,
      description: "Amplify App URL",
    });
  }

  private createLambdaFunction(config: {
    functionName: string;
    handler: string;
    description: string;
    memorySize?: number;
    timeout?: Duration;
    additionalEnv?: Record<string, string>;
    additionalDeps?: string[];
  }): lambda.Function {
    const logGroup = new logs.LogGroup(this, `${config.functionName}LogGroup`, {
      logGroupName: `/aws/lambda/${APP_NAME}-${config.functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const lambdaDir = `./lambdas/${config.functionName}`;

    const bundlingCommands: string[] = [
      "pip install --no-cache-dir --target /tmp/pip-packages uv",
      "export PYTHONPATH=/tmp/pip-packages:$PYTHONPATH",
      "cd /asset-input",
      `cp -r ${lambdaDir}/* /asset-output/`,
      `python -m uv pip install --python 3.12 --target /asset-output --requirements ${lambdaDir}/pyproject.toml`,
    ];

    // Install additional workspace packages if specified
    if (config.additionalDeps?.length) {
      const additionalDeps = config.additionalDeps.join(" ");
      bundlingCommands.push(
        `python -m uv pip install --no-sources --python 3.12 --target /asset-output ${additionalDeps}`
      );
    }

    // Remove unnecessary files to reduce bundle size
    bundlingCommands.push(
      "rm -rf /asset-output/pyproject.toml /asset-output/*.lock",
      // Remove boto3/botocore (already in Lambda runtime)
      "rm -rf /asset-output/boto3* /asset-output/botocore* /asset-output/s3transfer*",
      // Remove tests, docs, examples to save space
      "find /asset-output -type d -name tests -exec rm -rf {} + 2>/dev/null || true",
      "find /asset-output -type d -name test -exec rm -rf {} + 2>/dev/null || true",
      "find /asset-output -type d -name testing -exec rm -rf {} + 2>/dev/null || true",
      "find /asset-output -type d -name examples -exec rm -rf {} + 2>/dev/null || true",
      "find /asset-output -type d -name docs -exec rm -rf {} + 2>/dev/null || true",
      // Remove __pycache__ and .pyc files
      "find /asset-output -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true",
      "find /asset-output -name '*.pyc' -delete 2>/dev/null || true",
      "find /asset-output -name '*.pyo' -delete 2>/dev/null || true"
    );

    return new lambda.Function(this, config.functionName, {
      functionName: `${APP_NAME}-${config.functionName}`,
      description: config.description,
      handler: config.handler,
      runtime: lambda.Runtime.PYTHON_3_12,
      architecture: lambda.Architecture.ARM_64,
      memorySize: config.memorySize || 256,
      timeout: config.timeout || Duration.seconds(30),
      code: lambda.Code.fromAsset(this.backendRoot, {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          platform: "linux/arm64",
          command: ["bash", "-c", bundlingCommands.join(" && ")],
          volumes: [
            {
              hostPath: path.join(
                os.homedir(),
                ".cache",
                "corpus-query-lambda-cache"
              ),
              containerPath: "/.cache/uv",
            },
          ],
          environment: {
            UV_LINK_MODE: "copy",
          },
        },
      }),
      environment: config.additionalEnv || {},
      tracing: lambda.Tracing.ACTIVE,
      logGroup: logGroup,
    });
  }
}