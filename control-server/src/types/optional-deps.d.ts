// @aws-sdk/client-s3 is an optional dependency: the S3 backup adapter imports it
// dynamically and reports a clear error when it isn't installed. This shorthand
// declaration lets the project type-check without it.
declare module '@aws-sdk/client-s3';
