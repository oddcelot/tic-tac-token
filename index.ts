import { type } from "arktype";

const User = type({
  name: "string",
  platform: "'android' | 'ios'",
  "versions?": "(number | string)[]",
});
// extract the type if needed
type User = typeof User.infer;


const test: User = {}


const out = User({
  name: "Alan Turing",
  device: {
    platform: "enigma",
    versions: [0, "1", 0n],
  },
});
if (out instanceof type.errors) {
  // hover out.summary to see validation errors
  console.error(out.summary);
} else {
  // hover out to see your validated data
  console.log(`Hello, ${out.name}`);
}
