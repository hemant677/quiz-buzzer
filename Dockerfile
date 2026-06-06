# Use the official Node.js 20 lightweight Alpine image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy the root package configuration files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy backend and frontend source directories
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Expose the default Hugging Face Space port
EXPOSE 7860

# Define environment variables
ENV PORT=7860
ENV NODE_ENV=production

# Command to run the application
CMD ["npm", "start"]
