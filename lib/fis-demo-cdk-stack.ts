import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as fis from "aws-cdk-lib/aws-fis";

const tasksTarget = {
  resourceType: "aws:ecs:task",
  resourceTags: {
    "aws:ecs:clusterName": "test-fargate",
    "aws:ecs:serviceName": "fis-demoapi",
  },
  filters: [{ path: "LastStatus", values: ["RUNNING"] }],
};

export class FisDemoCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    if (!props?.env) {
      return;
    }

    const { account, region } = props.env;
    new fis.CfnExperimentTemplate(this, "StopTasksTemplate", {
      description: "If 50% of tasks are stopped then availability will not be impacted",
      actions: {
        "stop-tasks": {
          actionId: "aws:ecs:stop-task",
          targets: {
            Tasks: "ecs-tasks",
          },
        },
        wait: {
          actionId: "aws:fis:wait",
          parameters: {
            duration: "PT20M",
          },
          startAfter: ["stop-tasks"],
        },
        "check-availability": {
          actionId: "aws:cloudwatch:assert-alarm-state",
          parameters: {
            alarmArns: `arn:aws:cloudwatch:${region}:${account}:alarm:Demo API low availability`,
            alarmStates: "OK,INSUFFICIENT_DATA",
          },
          startAfter: ["stop-tasks", "wait"],
        },
      },
      targets: {
        "ecs-tasks": {
          ...tasksTarget,
          selectionMode: "PERCENT(50)",
        },
      },
      stopConditions: [
        {
          source: "aws:cloudwatch:alarm",
          value: `arn:aws:cloudwatch:${region}:${account}:alarm:Everythings on fire`,
        },
      ],
      roleArn: `arn:aws:iam::${account}:role/fis-demo`,
      tags: {
        Name: "stop-tasks-experiment",
      },
      experimentOptions: {
        accountTargeting: "single-account",
        emptyTargetResolutionMode: "fail",
      },
    });

    new fis.CfnExperimentTemplate(this, "CpuStressTemplate", {
      description: "If all tasks have 100% cpu usage there is no impact on availability",
      actions: {
        "stress-cpu": {
          actionId: "aws:ecs:task-cpu-stress",
          targets: {
            Tasks: "ecs-tasks",
          },
          parameters: {
            duration: "PT5M",
          },
        },
        "check-availability": {
          actionId: "aws:cloudwatch:assert-alarm-state",
          parameters: {
            alarmArns: `arn:aws:cloudwatch:${region}:${account}:alarm:Demo API low availability`,
            alarmStates: "OK,INSUFFICIENT_DATA",
          },
          startAfter: ["stress-cpu"],
        },
      },
      targets: {
        "ecs-tasks": {
          ...tasksTarget,
          selectionMode: "ALL",
        },
      },
      stopConditions: [
        {
          source: "aws:cloudwatch:alarm",
          value: `arn:aws:cloudwatch:${region}:${account}:alarm:Everythings on fire`,
        },
      ],
      roleArn: `arn:aws:iam::${account}:role/fis-demo`,
      tags: {
        Name: "cpu-stress-experiment",
      },
      experimentOptions: {
        accountTargeting: "single-account",
        emptyTargetResolutionMode: "fail",
      },
    });
  }
}
