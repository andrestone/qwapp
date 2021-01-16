import * as aws from 'aws-sdk';
import { Handler } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';


// Uses the docker-compose.yml from https://github.com/nQuake/server-docker

/**
 * QW Server Settings
 */

const KTX_HOSTNAME = 'QWApp KTX @ ';
const KTX_SERVER_IP = '';
const KTX_SERVER_PORT = '27500';
const KTX_RCON_PASSWORD = uuidv4().slice(0, 5);
const KTX_QTV_PASSWORD = uuidv4().slice(0, 5);
const KTX_SERVER_ADMIN = 'QWApp <qwapp@quake.world>';
const MVDSV_SERVER_MEMORY_BYTES = '65536';
const QTV_REPORT_URL = 'https://badplace.eu';
const QTV_REPORT_KEY = 'askmeag';
const QTV_HOSTNAME = 'QWApp QTV @ ';
const QTV_SERVER_IP = '';
const QTV_PASSWORD = '';
const QTV_ADMIN_PASSWORD = uuidv4().slice(0, 5);
const QTV_SERVER_PORT = '28000';
const QWFWD_HOSTNAME = 'QWApp QWFWD Proxy @ ';
const QWFWD_SERVER_PORT = '30000';

/**
 * The HTTP response type
 */
interface ApiResponse {
  /**
   * HTTP Status code
   */
  readonly statusCode: number;

  /**
   * Basic header with ContentType
   */
  readonly headers: {
    'Content-Type': string;
  };

  /**
   * Response body
   */
  readonly body: ApiResponseBody;
}


/**
 * The API Response body
 */
interface ApiResponseBody {
  /**
   * If the call succeeded
   */
  readonly success: boolean;

  /**
   * A message from the server
   */
  readonly message: string;

  /**
   * Any data
   */
  readonly data?: any;
}

/**
 * Creates an EC2 instance with custom userdata for a containerized QW server to run
 * Authentication / authorization is handled by ApiGW resource policies
 */
export const createServer: Handler<any, ApiResponse> = async (event) => {
  if (!event?.queryStringParametrs?.region) {
    return sendWrongApiCall();
  }

  // Region
  const region = event.queryStringParametrs.region;

  // The unique server ID
  const serverId = uuidv4();

  // SSM Parameter Store Client
  const ssm = new aws.SSM();

  // Latest Amazon Linux AMI
  try {
    const latestAMI = ((await ssm
      .getParameters({
        Names: ['/aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-gp2'],
      })
      .promise()) as any)[0].Value;

    // The userdata
    const userData = `
      amazon-linux-extras install docker -y
      usermod -a -G docker ec2-user
      service docker start
      curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose
      chmod +x /usr/local/bin/docker-compose
      export QWSERVER_ID = ${serverId}
      mkdir -p /home/ec2-user/nquakesv-docker
      cat > /home/ec2-user/nquakesv-docker/docker-compose.yml << EOF
version: '3.7'

services:
  mvdsv:
    image: niclaslindstedt/nquakesv
    restart: always
    environment:
      - HOSTNAME=${KTX_HOSTNAME}${region}
      - SERVER_IP=${KTX_SERVER_IP} # this is your server's external ip, leave it empty to look up your external ip
      - PORT=${KTX_SERVER_PORT} # this is the external port number for this server
      - RCON_PASSWORD=${KTX_RCON_PASSWORD}
      - QTV_PASSWORD=${KTX_QTV_PASSWORD}
      - SERVER_ADMIN=${KTX_SERVER_ADMIN}
      - REPORT_URL=${QTV_REPORT_URL}
      - REPORT_KEY=${QTV_REPORT_KEY}
      - SERVER_MEMORY_KBYTES=${MVDSV_SERVER_MEMORY_BYTES} # memory allocation for server process
    ports:
      - '${KTX_SERVER_PORT}:${KTX_SERVER_PORT}/udp'
    volumes:
      - "/etc/timezone:/etc/timezone:ro" # This will make sure logs inside the container are in the timezone of the server
      - "/etc/localtime:/etc/localtime:ro" # This will make sure logs inside the container are in the timezone of the server
      - logs:/nquake/logs
      - media:/nquake/media
      - demos:/nquake/demos
    restart: always
    healthcheck:
      test: ["CMD", "/healthcheck.sh"]
      interval: 1m
      timeout: 10s
      retries: 3
      start_period: 20s

  qtv:
    image: niclaslindstedt/qtv
    restart: always
    tty: true
    environment:
      - HOSTNAME=${QTV_HOSTNAME}${region}
      - SERVER_IP=${QTV_SERVER_IP} # this is your server's external ip, leave it empty to look up your external ip
      - QTV_PASSWORD=${QTV_PASSWORD}
      - ADMIN_PASSWORD=${QTV_ADMIN_PASSWORD}
      - TARGET_SERVERS=mvdsv:${KTX_SERVER_PORT}
    ports:
      - '${QTV_SERVER_PORT}:28000'
    volumes:
      - demos:/qtv/demos
      - media:/qtv/id1
    healthcheck:
      test: ["CMD", "/healthcheck.sh"]
      interval: 1m
      timeout: 10s
      retries: 3
      start_period: 20s

  qwfwd:
    image: niclaslindstedt/qwfwd
    restart: always
    tty: true
    environment:
      - HOSTNAME=${QWFWD_HOSTNAME}${region}
    ports:
      - '${QWFWD_SERVER_PORT}:30000/udp'

volumes:
  logs:
  demos:
  media:
EOF
    cd /home/ec2-user/nquakesv-docker
    docker-compose up
    `;

    // EC2 client
    const client = new aws.EC2({
      region,
    });

    // Creating the instance
    const instance = await client
      .runInstances({
        ImageId: latestAMI,
        UserData: userData,
        MaxCount: 1,
        MinCount: 1,
      })
      .promise();
    return sendRes(200, {
      success: true,
      message: `QW server ${serverId} (instance ${instance.Instances![0].InstanceId} requested. `,
    });
  } catch (err) {
    console.log(`Error when creating new instance: ${err}`);
    return sendRes(500, { success: true, message: "An error has occurred, couldn't start the instance." });
  }
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
    await client
      .terminateInstances({
        InstanceIds: [instanceId],
      })
      .promise();
    return sendRes(200, { success: true, message: `QW server ${uid} (instance ${instanceId}) terminated.` });
  } catch (err) {
    console.log(`Error when terminating instance ${instanceId}`);
    console.log(err);
    return sendRes(500, { success: false, message: "An error has occurred, couldn't terminate instances." });
  }
};

/**
 * Send HTTP response
 */
const sendRes = (status: number, body: ApiResponseBody) => {
  var response = {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body,
  };
  return response;
};

/**
 * Wrapper for malformed / bad requests.
 */
const sendWrongApiCall = () => {
  return sendRes(400, { success: false, message: 'Malformed request.' });
};
