import * as cdk from '@aws-cdk/core';
import * as fn from '@aws-cdk/aws-lambda';
import * as path from 'path';
import * as apigw from '@aws-cdk/aws-apigateway';

export class IacStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create Server Lambda
    const createServerLambda = new fn.Function(this, 'QWAppCreateServer', {
      code: fn.Code.fromAsset(path.join(__dirname, '../../api')),
      handler: 'api.createServer',
      runtime: fn.Runtime.NODEJS_12_X,
    });

    // Terminate Server Lambda
    const terminateServerLambda = new fn.Function(this, 'QWAppTerminateServer', {
      code: fn.Code.fromAsset(path.join(__dirname, '../../api')),
      handler: 'api.terminateServer',
      runtime: fn.Runtime.NODEJS_12_X,
    });

    // The API Gateway
    const api = new apigw.LambdaRestApi(this, 'QWAppApi', {
      handler: createServerLambda,
      proxy: false,
      endpointTypes: [apigw.EndpointType.REGIONAL],
    });

    // FIXME: Authorizations
    api.root.resourceForPath('createServer').addMethod('POST', new apigw.LambdaIntegration(createServerLambda));
    api.root.resourceForPath('terminateServer').addMethod('POST', new apigw.LambdaIntegration(terminateServerLambda));
  }
}
