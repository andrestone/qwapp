import * as aws from 'aws-sdk';
import { Handler } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';

/**
 * Creates an EC2 instance with custom userdata for a containerized QW server to run
 */
export const createServer: Handler = (event, context: Context, callback) => {
  // The unique server ID
  const serverId = uuidv4();

  // EC2 client
  const client = new aws.EC2();

  // The userdata
  const userData = `
sudo amazon-linux-extras install docker -y
sudo usermod -a -G docker ec2-user
sudo service docker start
sudo curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
 `;
  // Creating the instance
};

/**
 * Receives the call from the server requestig to self-destroy
 */
export const terminateServer: Handler = async (event) => {
  if (!event?.queryStringParametrs?.token || event?.queryStringParametrs?.instanceId) {
    return sendWrongApiCall();
  }

  // If call is OK, proceed.
  const uid = event?.queryStringParametrs?.uid;
  const instanceId = event?.queryStringParametrs?.instancId;

  // EC2 client
  const client = new aws.EC2();

  // Terminating the instance
  try {
    client.terminateInstances({
      InstanceIds: [instanceId],
    });
    return sendRes(200, `QW server ${uid} (instance ${instanceId}) terminated.`);
  } catch (err) {
    console.log(`Error when terminating instance ${instanceId}`);
    console.log(err);
    return sendRes(500, "An error has occurred, couldn't terminate instances.");
  }
};

/**
 * Send HTTP response
 */
const sendRes = (status: number, body: string) => {
  var response = {
    statusCode: status,
    headers: {
      'Content-Type': 'text/plain',
    },
    body: body,
  };
  return response;
};

/**
 * Wrapper for malformed / bad requests.
 */
const sendWrongApiCall = () => {
  return sendRes(400, 'Malformed request.');
};
