import { INestApplication } from '@nestjs/common';

interface RouterLayer {
  route?: { path: string; methods: Record<string, boolean> };
}

interface ExpressInstance {
  router: { stack: RouterLayer[] };
}

export function registeredRoutes(app: INestApplication): string[] {
  const { router } = app.getHttpAdapter().getInstance() as ExpressInstance;

  return router.stack.flatMap(({ route }) =>
    route
      ? Object.keys(route.methods).map(
          (method) => `${method.toUpperCase()} ${route.path}`,
        )
      : [],
  );
}
