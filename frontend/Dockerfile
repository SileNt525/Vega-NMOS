# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Make port 5173 available to the world outside this container (Vite default)
EXPOSE 5173

# Run the app when the container launches
CMD ["npm", "run", "dev"]