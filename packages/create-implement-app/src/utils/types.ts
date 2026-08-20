declare const brand: unique symbol;

type Brand<B extends string> = { [brand]: B };

/** Allows you to create a branded type.
 *
 * ## Usage
 * ```ts
 * type Milliseconds = Branded<number, "milliseconds">;
 * ```
 */
export type Branded<T, B extends string> = T & Brand<B>;

/** An absolute path. Every path that touches the file system is one of these. */
export type AbsolutePath = Branded<string, "absolutePath">;
