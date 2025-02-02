import * as fs from "fs";
import * as os from "os";
import { join } from "path";
import {
  ENV_WING_SIM_INFLIGHT_RESOURCE_PATH,
  ENV_WING_SIM_INFLIGHT_RESOURCE_TYPE,
} from "./function";
import { ISimulatorResourceInstance } from "./resource";
import { LoggerAttributes, LoggerSchema } from "./schema-resources";
import { ILoggerClient, TraceType } from "../cloud";
import { ISimulatorContext } from "../testing";

export class Logger implements ILoggerClient, ISimulatorResourceInstance {
  private readonly logsDir: string;
  private readonly context: ISimulatorContext;
  public constructor(
    _props: LoggerSchema["props"],
    context: ISimulatorContext
  ) {
    this.logsDir = fs.mkdtempSync(join(os.tmpdir(), "wing-sim-"));
    this.context = context;
  }

  public async init(): Promise<LoggerAttributes> {
    return {};
  }

  public async cleanup(): Promise<void> {
    // TODO: clean up logs dir?
    return;
  }

  public async log(message: string): Promise<void> {
    if (!fs.existsSync(this.logsDir)) {
      throw new Error(`Logs directory ${this.logsDir} does not exist.`);
    }

    // TODO: add some other compute context mechanism?
    const resourcePath = process.env[ENV_WING_SIM_INFLIGHT_RESOURCE_PATH]!;
    const resourceType = process.env[ENV_WING_SIM_INFLIGHT_RESOURCE_TYPE]!;

    return this.context.addTrace({
      data: { message },
      type: TraceType.LOG,
      sourcePath: resourcePath,
      sourceType: resourceType,
      timestamp: new Date().toISOString(),
    });
  }
}
