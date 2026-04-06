import type { Request, RequestHandler, Response } from "express";

import { ZodError, type ZodTypeAny, type output as ZodOutput } from "zod";

import { AppError } from "./errors.js";

type SchemaOrUndefined = ZodTypeAny | undefined;

type InferInput<
  Schema extends SchemaOrUndefined,
  Fallback,
> = Schema extends ZodTypeAny ? ZodOutput<Schema> : Fallback;

export type ValidatedParams<Schema extends SchemaOrUndefined = undefined> =
  InferInput<Schema, Record<string, never>>;

export type ValidatedQuery<Schema extends SchemaOrUndefined = undefined> =
  InferInput<Schema, Record<string, never>>;

export type ValidatedBody<Schema extends SchemaOrUndefined = undefined> =
  InferInput<Schema, undefined>;

export type ValidationSchemas<
  ParamsSchema extends SchemaOrUndefined = undefined,
  QuerySchema extends SchemaOrUndefined = undefined,
  BodySchema extends SchemaOrUndefined = undefined,
> = {
  params?: ParamsSchema;
  query?: QuerySchema;
  body?: BodySchema;
};

export type ValidatedRequestData<
  ParamsSchema extends SchemaOrUndefined = undefined,
  QuerySchema extends SchemaOrUndefined = undefined,
  BodySchema extends SchemaOrUndefined = undefined,
> = {
  params: ValidatedParams<ParamsSchema>;
  query: ValidatedQuery<QuerySchema>;
  body: ValidatedBody<BodySchema>;
};

export type ValidatedRouteContext<
  ParamsSchema extends SchemaOrUndefined = undefined,
  QuerySchema extends SchemaOrUndefined = undefined,
  BodySchema extends SchemaOrUndefined = undefined,
> = ValidatedRequestData<ParamsSchema, QuerySchema, BodySchema> & {
  req: Request;
  res: Response;
};

export type ValidatedRouteHandler<
  ParamsSchema extends SchemaOrUndefined = undefined,
  QuerySchema extends SchemaOrUndefined = undefined,
  BodySchema extends SchemaOrUndefined = undefined,
> = (
  context: ValidatedRouteContext<ParamsSchema, QuerySchema, BodySchema>,
) => void | Promise<void>;

const EMPTY_INPUT = Object.freeze({}) as Record<string, never>;

export function validatedRoute<
  ParamsSchema extends SchemaOrUndefined = undefined,
  QuerySchema extends SchemaOrUndefined = undefined,
  BodySchema extends SchemaOrUndefined = undefined,
>(
  schemas: ValidationSchemas<ParamsSchema, QuerySchema, BodySchema>,
  handler: ValidatedRouteHandler<ParamsSchema, QuerySchema, BodySchema>,
): RequestHandler {
  return async (req, res) => {
    try {
      const params = schemas.params
        ? schemas.params.parse(req.params)
        : EMPTY_INPUT;
      const query = schemas.query
        ? schemas.query.parse(req.query)
        : EMPTY_INPUT;
      const body = schemas.body ? schemas.body.parse(req.body) : undefined;

      await handler({
        req,
        res,
        params: params as ValidatedParams<ParamsSchema>,
        query: query as ValidatedQuery<QuerySchema>,
        body: body as ValidatedBody<BodySchema>,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        throw new AppError({
          statusCode: 400,
          code: "validation_error",
          message: "Request validation failed",
          details: {
            issues: error.issues,
          },
        });
      }

      throw error;
    }
  };
}
