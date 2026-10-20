import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const userSchema = new Schema(
  {
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      default: null,
    },
    firstName: { type: String, default: null },
    lastName: { type: String, default: null },
    profileImageUrl: { type: String, default: null },
    passwordHash: { type: String, default: null },
    isManager: { type: Boolean, default: false },
  },
  { timestamps: true, id: false, collection: "users" },
);

export type User = InferSchemaType<typeof userSchema>;

export const UserModel =
  (models.User as Model<User>) ?? model<User>("User", userSchema);
