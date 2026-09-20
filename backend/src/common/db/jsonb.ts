/**
 * Identity cast for `jsonb` column values.
 *
 * TypeORM's `QueryDeepPartialEntity` recurses into object types, so a column
 * typed `Record<string, unknown>` is rejected by `insert()` and `update()` even
 * though the value is exactly right. Every workaround is a cast; this puts the
 * cast in one place with the reason attached, instead of scattering `as never`
 * through the services.
 */
export const jsonb = <T>(value: T): never => value as never;
