import { matcher } from "@implementjs/kit/params";
import * as v from "valibot";

/**
 * A parsing matcher: `[id=integer]` binds a `number`, not a `string`. Built
 * from a schema, so the one declaration gates the segment, types the param,
 * and describes it in the OpenAPI document.
 */
export default matcher(v.pipe(v.string(), v.digits(), v.transform(Number), v.integer()));
