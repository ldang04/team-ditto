/**
 * __mocks__/supabase.ts
 *
 * Simple Jest mock of a Supabase client used in tests. Mirrors the
 * minimal API surface used across the codebase: supabase.from(table)
 * with chained insert/select/update/eq/single/delete methods.
 *
 * Tests can import/reset the in-memory tables via `resetMockTables`.
 */

type Row = Record<string, any>;

const mockTables: Record<string, Row[]> = {
  clients: [],
  api_keys: [],
  users: [],
  projects: [],
  themes: [],
  contents: [],
  embeddings: [],
};

const makeResponse = async (data: any = null, error: any = null) => ({
  data,
  error,
});

export const supabase = {
  storage: {
    async listBuckets() {
      return makeResponse([{ id: "mock-bucket-1", name: "content-images" }]);
    },
    async createBucket() {
      // Pretend bucket creation succeeds
      return makeResponse(null, null);
    },
    from: (bucketName: string) => {
      // In-memory storage map: bucket -> files
      const storageMap: Record<string, Record<string, any>> = (supabase as any)
        .__storageMap || ((supabase as any).__storageMap = {});
      const bucket = (storageMap[bucketName] ||= {});

      return {
        async upload(fileName: string) {
          bucket[fileName] = {
            publicUrl: `https://mock.supabase.co/storage/v1/object/public/${bucketName}/${fileName}`,
          };
          return makeResponse(null, null);
        },
        getPublicUrl(fileName: string) {
          const file = bucket[fileName] || {
            publicUrl: `https://mock.supabase.co/storage/v1/object/public/${bucketName}/${fileName}`,
          };
          return { data: { publicUrl: file.publicUrl } } as any;
        },
        async remove(paths: string[]) {
          paths.forEach((p) => delete bucket[p]);
          return makeResponse(null, null);
        },
        async list(prefix: string, opts?: { search?: string }) {
          const entries = Object.keys(bucket)
            .filter((key) => key.startsWith(prefix))
            .filter((key) =>
              opts?.search ? key.includes(opts.search as string) : true
            )
            .map((key) => ({ name: key }));
          return makeResponse(entries, null);
        },
        async createSignedUrl(filePath: string) {
          return makeResponse(
            { signedUrl: `https://mock.signed/${filePath}` },
            null
          );
        },
      };
    },
  },
  from: (table: string) => {
    const store = mockTables[table] ?? [];

    return {
      insert: (payload: any) => ({
        select: () => ({
          single: async () => {
            const row = Array.isArray(payload) ? payload[0] : payload;
            const inserted = { id: `mock-${store.length + 1}`, ...row };
            store.push(inserted);
            return makeResponse(inserted, null);
          },
        }),
      }),

      select: () => ({
        eq: (field: string, value: any) => {
          const filtered = store.filter((r) => r[field] === value);

          // Return a promise when awaited directly
          const promise = makeResponse(filtered, null);
          (promise as any).single = async () => {
            const found = filtered[0] ?? null;
            return makeResponse(found, found ? null : { message: "Not found" });
          };

          return promise;
        },

        in: (field: string, values: any[]) => {
          const set = new Set(values ?? []);
          const filtered = store.filter((r) => set.has(r[field]));
          return makeResponse(filtered, null);
        },

        async single() {
          return makeResponse(store.length ? store[0] : null, null);
        },

        order: () => ({
          single: async () => makeResponse(store, null),
        }),
      }),

      update: (updates: any) => ({
        eq: (field: string, value: any) => ({
          select: () => ({
            single: async () => {
              const idx = store.findIndex((r) => r[field] === value);
              if (idx === -1)
                return makeResponse(null, { message: "Not found" });
              store[idx] = { ...store[idx], ...updates };
              return makeResponse(store[idx], null);
            },
          }),
        }),
      }),

      delete: () => ({
        eq: async (field: string, value: any) => {
          const before = store.length;
          const filtered = store.filter((r) => r[field] !== value);
          mockTables[table] = filtered;
          return makeResponse(before !== filtered.length, null);
        },
      }),
    };
  },
};

export const resetMockTables = () => {
  Object.keys(mockTables).forEach((k) => (mockTables[k] = []));
};
