/**
 * Platform seam for Dataverse data access.
 *
 * `getClient` binds the generated data-source metadata to a strongly-typed
 * client (`retrieveMultipleRecordsAsync`, `createRecordAsync`, ...). Feature
 * services depend on this module rather than importing the Power SDK directly,
 * so the platform integration point stays in one place (mirrors
 * `power-context.ts`).
 */
import { getClient } from "@microsoft/power-apps/data"
import type { DataClient } from "@microsoft/power-apps/data"
// `.power` lives outside `src`; import it the same way the generated services do.
import { dataSourcesInfo } from "../../../.power/schemas/appschemas/dataSourcesInfo"

export const dataClient: DataClient = getClient(dataSourcesInfo)
