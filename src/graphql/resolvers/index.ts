import { GraphQLScalarType, Kind } from 'graphql';
import { sourceResolvers } from './sourceResolvers.js';
import { dataResolvers } from './dataResolvers.js';
import { summaryResolvers } from './summaryResolvers.js';

const dateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  description: 'DateTime custom scalar type',
  serialize(value: any) {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  },
  parseValue(value: any) {
    return new Date(value);
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      return new Date(ast.value);
    }
    return null;
  },
});

export const resolvers = {
  DateTime: dateTimeScalar,

  Query: {
    ...sourceResolvers.Query,
    ...dataResolvers.Query,
    ...summaryResolvers.Query,
  },

  Mutation: {
    ...sourceResolvers.Mutation,
    ...dataResolvers.Mutation,
    ...summaryResolvers.Mutation,
  },

  Source: sourceResolvers.Source,
  Article: dataResolvers.Article,
};

export default resolvers;
