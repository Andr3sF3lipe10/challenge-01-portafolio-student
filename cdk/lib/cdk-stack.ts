import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as path from 'path';

export class PortafolioStudentStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Bucket S3 (Privado y con auto-eliminación)
    const portfolioBucket = new s3.Bucket(this, 'PortfolioBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [{
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
      }],
    });

    // 2. Distribución CloudFront (Boss Fight: Price Class 200)
    const distribution = new cloudfront.Distribution(this, 'PortfolioDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(portfolioBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200, 
    });

    // 3. Despliegue automático de tus archivos HTML/CSS
    // Esto busca tu carpeta 'application' basándose en la estructura de tu VS Code
    new s3deploy.BucketDeployment(this, 'DeployPortfolioFiles', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../application'))],
      destinationBucket: portfolioBucket,
      distribution: distribution,
      distributionPaths: ['/*'], // Invalida la caché para ver los cambios inmediatamente
    });

    // 4. Tabla DynamoDB
    const table = new dynamodb.Table(this, 'PortfoliosTable', {
      partitionKey: { name: 'studentId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 5. Roles IAM (Mínimo Privilegio)
    const backendRole = new iam.Role(this, 'PortfolioBackendRole', {
      assumedBy: new iam.AccountRootPrincipal(),
    });
    portfolioBucket.grantReadWrite(backendRole);
    table.grantReadWriteData(backendRole);

    // 6. Outputs para tu terminal
    new cdk.CfnOutput(this, 'CloudFrontURL', { value: `https://${distribution.distributionDomainName}` });
    new cdk.CfnOutput(this, 'DynamoTableName', { value: table.tableName });
  }
}