import { relative } from "path";
import { Construct } from "constructs";
import { ISimulatorResource } from "./resource";
import { BaseResourceSchema } from "./schema";
import { FunctionSchema, FUNCTION_TYPE } from "./schema-resources";
import { bindSimulatorResource, makeSimulatorJsClient } from "./util";
import * as cloud from "../cloud";
import * as core from "../core";
import { App } from "../core";
import { Duration } from "../std/duration";

export const ENV_WING_SIM_INFLIGHT_RESOURCE_PATH =
  "WING_SIM_INFLIGHT_RESOURCE_PATH";
export const ENV_WING_SIM_INFLIGHT_RESOURCE_TYPE =
  "WING_SIM_INFLIGHT_RESOURCE_TYPE";

/**
 * Simulator implementation of `cloud.Function`.
 *
 * @inflight `@winglang/sdk.cloud.IFunctionClient`
 */
export class Function extends cloud.Function implements ISimulatorResource {
  private readonly code: core.Code;
  private readonly timeout: Duration;
  constructor(
    scope: Construct,
    id: string,
    inflight: cloud.IFunctionHandler,
    props: cloud.FunctionProps = {}
  ) {
    super(scope, id, inflight, props);

    // props.memory is unused since we are not simulating it
    this.timeout = props.timeout ?? Duration.fromMinutes(1);
    this.code = core.NodeJsCode.fromFile(this.assetPath);
  }

  public toSimulator(): BaseResourceSchema {
    const workdir = App.of(this).workdir;
    const schema: FunctionSchema = {
      type: FUNCTION_TYPE,
      path: this.node.path,
      props: {
        sourceCodeFile: relative(workdir, this.code.path),
        sourceCodeLanguage: "javascript",
        environmentVariables: this.env,
        timeout: this.timeout.seconds * 1000,
      },
      attrs: {} as any,
    };
    return schema;
  }

  /** @internal */
  public _bind(host: core.IInflightHost, ops: string[]): void {
    bindSimulatorResource("function", this, host);
    super._bind(host, ops);
  }

  /** @internal */
  public _toInflight(): core.Code {
    return makeSimulatorJsClient("function", this);
  }
}

Function._annotateInflight("invoke", {});
