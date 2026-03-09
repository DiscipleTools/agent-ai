import { connectDB } from '../utils/db'

export default async () => {
  await connectDB()
}