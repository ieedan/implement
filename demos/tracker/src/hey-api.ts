import type { CreateClientConfig } from "./api/client.gen";

export const createClientConfig: CreateClientConfig = (config) => ({
	...config,
	baseUrl: "http://localhost:4001",
});
