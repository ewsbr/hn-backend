import axios from 'axios';


axios.interceptors.request.use(function (config) {

  config.metadata = { startTime: new Date()}
  return config;
}, function (error) {
  return Promise.reject(error);
});

axios.interceptors.response.use(function (response) {

  response.config.metadata.endTime = new Date()
  response.duration = response.config.metadata.endTime - response.config.metadata.startTime
  return response;
}, function (error) {
  error.config.metadata.endTime = new Date();
  error.duration = error.config.metadata.endTime - error.config.metadata.startTime;
  return Promise.reject(error);
});

async function main() {
  const lastPost = await axios.get('https://hacker-news.firebaseio.com/v0/maxitem.json');
  console.log(lastPost.data)

  console.log(`https://hacker-news.firebaseio.com/v0/item/${lastPost.data}.json`)

  const arr = []

  for (let i = 0; i < 1000; i++) {
    arr.push(axios.get(`https://hacker-news.firebaseio.com/v0/item/${lastPost.data - i}.json`))
  }

  const posts = await Promise.all(arr)
  console.log(posts.map(post => {
    return {
      ...post.data,
      duration: post.duration
    }
  }))
}

main().then(() => {
  console.log('done')
})