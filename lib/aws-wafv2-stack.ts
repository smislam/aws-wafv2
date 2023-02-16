import * as cdk from 'aws-cdk-lib';
import { ContainerImage } from 'aws-cdk-lib/aws-ecs';
import { ApplicationLoadBalancedFargateService } from 'aws-cdk-lib/aws-ecs-patterns';
import { CfnRuleGroup, CfnWebACL, CfnWebACLAssociation } from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';

export class AwsWafv2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const loadBalancedFargateService = new ApplicationLoadBalancedFargateService(this, 'wafService', {
      memoryLimitMiB: 512,
      desiredCount: 1,
      cpu: 256,
      taskImageOptions: {
        image: ContainerImage.fromAsset('./src'),
      },
    });

    type wafRuleType = {
      name: string;
      priority: number;
      overrideAction: string;
      excludedRules: string[];
    };

    var rules: CfnRuleGroup.RuleProperty[] = [];

    const awsWafRules = [
      "AWSManagedRulesCommonRuleSet",
      "AWSManagedRulesAmazonIpReputationList",
      "AWSManagedRulesKnownBadInputsRuleSet",
      "AWSManagedRulesAnonymousIpList",
      "AWSManagedRulesLinuxRuleSet",
      "AWSManagedRulesUnixRuleSet"
    ];

    var priorityStart = 10;
    awsWafRules.forEach(awsrule => {
      var statementProp: CfnWebACL.StatementProperty = {
        managedRuleGroupStatement: {
          name: awsrule,
          vendorName: 'AWS'
        }
      }

      var rule: CfnWebACL.RuleProperty = {
        name: awsrule,
        priority: ++priorityStart,
        overrideAction: {none:{}},
        statement: statementProp,
        visibilityConfig: {
          metricName: awsrule,
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
        }
      }
      rules.push(rule);
    });


    var customResponseKey1 = {
      'Content': 'waf.html',
      'Content-Type': 'text/html'
    };

    //Adding custom rules.  Just one.
    const urlBlockRule: CfnWebACL.RuleProperty = {
      name: 'blockuri',
      priority: 0, //making this first rule before all other aws defaults. No need to wait.
      action: {
        block:{
          customResponse: {
            customResponseBodyKey: 'customResponseKey1',
            responseCode: 302,
            responseHeaders: [{
              name: 'wafblock',
              value: 'wafblock'
            }]
          }
        }
      },
      statement: {     
        byteMatchStatement: {
          searchString: '/secure.html',
          positionalConstraint: 'ENDS_WITH',
          fieldToMatch: {
            uriPath: {}
          },
          textTransformations: [{
            priority: 0,
            type: 'NONE'
          }]
        }
      },
      visibilityConfig: {
        metricName: 'blockuri',
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
      }
    }
    rules.push(urlBlockRule);
    
    const wafBlockResponse = "<!DOCTYPE html> \
      <html> \
          <head> \
              <title>Welcome to Wafv2 Secured section</title> \
          </head> \
          <body> \
              <h1>You have been WAFFED!</h1> \
              <p>If you see this page, You have been served waffle!  Got any syrup?</p> \
          </body> \
      </html>";
    
    const wafacl = new CfnWebACL(this, 'wafacl', {
      name: 'mywafacl',
      description: 'My WAF ACL',
      scope: 'REGIONAL',
      defaultAction: {
        allow: {}
      },
      visibilityConfig: {
        metricName: 'wafmetric',
        cloudWatchMetricsEnabled: true,
        sampledRequestsEnabled: true
      },
      customResponseBodies: {
        'customResponseKey1': {
          content: wafBlockResponse,
          contentType: 'TEXT_HTML'
        }
      },
      rules: rules
    });

    //associate the waf to ALB
    const wafassocalb = new CfnWebACLAssociation(this, 'wafassocalb', {
      webAclArn: wafacl.attrArn,
      resourceArn: loadBalancedFargateService.loadBalancer.loadBalancerArn
    });    
  }
}