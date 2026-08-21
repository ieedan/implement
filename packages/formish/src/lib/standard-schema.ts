/**
 * The [Standard Schema](https://standardschema.dev) v1 interface, vendored so
 * formish depends on no schema library of its own — valibot, zod, arktype and
 * anything else implementing the spec all fit. The shapes mirror
 * `@standard-schema/spec` (MIT), which is what makes them interchangeable.
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
	readonly "~standard": StandardSchemaProps<Input, Output>;
}

export interface StandardSchemaProps<Input, Output> {
	readonly version: 1;
	readonly vendor: string;
	/** Validates a value. May resolve asynchronously. */
	readonly validate: (value: unknown) => StandardResult<Output> | Promise<StandardResult<Output>>;
	/** Inference-only: never present at runtime. */
	readonly types?: StandardTypes<Input, Output> | undefined;
}

export type StandardResult<Output> = StandardSuccessResult<Output> | StandardFailureResult;

export interface StandardSuccessResult<Output> {
	readonly value: Output;
	readonly issues?: undefined;
}

export interface StandardFailureResult {
	readonly issues: readonly StandardIssue[];
}

export interface StandardIssue {
	readonly message: string;
	/** Missing or empty for an issue about the value as a whole. */
	readonly path?: ReadonlyArray<PropertyKey | StandardPathSegment> | undefined;
}

export interface StandardPathSegment {
	readonly key: PropertyKey;
}

export interface StandardTypes<Input, Output> {
	readonly input: Input;
	readonly output: Output;
}

/** The type a schema accepts, e.g. what the form's fields hold. */
export type InferInput<TSchema extends StandardSchemaV1> = NonNullable<
	TSchema["~standard"]["types"]
>["input"];

/** The type a schema produces, e.g. what a submit handler receives. */
export type InferOutput<TSchema extends StandardSchemaV1> = NonNullable<
	TSchema["~standard"]["types"]
>["output"];
