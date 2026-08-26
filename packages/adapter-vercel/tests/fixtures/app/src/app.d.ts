declare global {
	namespace App {
		interface Locals {
			user: string | null;
		}

		interface Platform {
			context: { waitUntil?: (promise: Promise<unknown>) => void };
		}
	}
}
