# Governed Infrastructure as Code (GIaC)

**Governed Infrastructure as Code** (**GIaC**) is an opinionated approach to
generating container configuration files that can then be loaded into Docker,
Kubernetes, AWS ECR/ECS, and other engines.

GIaC uses [TypeScript](https://typescriptlang.org/) as the core configuration
language and generates appropriate Dockerfile, docker-compose.yml, and related
artifacts.

The GIaC is designed to specify, in a container-engine and orchestration
agnostic approach, complex validatable container definitions. It's based on a
"specify once, generate many" design philosophy.
