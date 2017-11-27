# Amazon Goldbox RSS

Does a few things to jumpstart and automate some of the affiliate work:
 - By default, runs daily at 8:50am
 - Grabs the XML feed and translates it to JSON
 - Cleans up the meta into a more usable format
 - Adds the affiliate ID as a tag to all links
 - Finally, dumps it in the bucket

## Prerequisites
 - AWS IAM user set up and configured
 
## Get Started
1. `npm install`
2. Create a your configuration file as outlined below
3. `sls offline start`

This should jump start you into a local instance. An endpoint should now be available at `localhost:3000/goldbox` which will dump into your S3 bucket per your configuration and stage defined in your serverless config.

## Deploying
`sls deploy`

## Configuration
Create a file in the root of the project called `env.yml` with the following:
```
affiliate_id: <Affiliate ID>
bucket: <Bucket Name>
```
