const { createHash } = require("node:crypto");
function filesFixture() {
  const data = new Map(),
    reads = [],
    writes = [],
    handlers = new Set();
  let scope = "shared";
  const revision = (text) =>
    text === undefined
      ? "missing"
      : createHash("sha256").update(text).digest("hex");
  const resolve = (value) =>
    value === "configuration" ? scope : (value ?? "device");
  const files = {
    readText: async (name, target) => {
      target = resolve(target);
      reads.push([target, name]);
      const text = data.get(target + "/" + name);
      return { text: text ?? null, revision: revision(text), scope: target };
    },
    writeText: async (name, text, expectedRevision, target) => {
      target = resolve(target);
      if (expectedRevision !== revision(data.get(target + "/" + name)))
        throw Object.assign(new Error("Conflict"), { code: "CONFLICT" });
      if (files.failWrite?.(name)) throw new Error("Write failed");
      data.set(target + "/" + name, text);
      writes.push([target, name, text]);
      return { revision: revision(text), scope: target };
    },
    delete: async (name, expectedRevision, target) => {
      target = resolve(target);
      if (expectedRevision !== revision(data.get(target + "/" + name)))
        throw Object.assign(new Error("Conflict"), { code: "CONFLICT" });
      if (files.failDelete?.(name)) throw new Error("Delete failed");
      data.delete(target + "/" + name);
      return { revision: "missing", scope: target };
    },
    onScopeChanged: (handler) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
  };
  return {
    files,
    data,
    reads,
    writes,
    async switchScope(next) {
      scope = next;
      for (const handler of handlers) await handler(next);
    },
  };
}
module.exports = { filesFixture };
