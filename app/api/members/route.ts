
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import Member from "@/models/Member";

export async function GET() {
  await mongoose.connect(process.env.MONGO_URI!);
  const data = await Member.find();
  return NextResponse.json(data);
}