const fastify = require("fastify")({ logger: true });
const Parser = require("rss-parser");
const nalapa = require("nalapa");

const news = async (url) => {
  const parser = new Parser({
    customFields: {
      item: ["image","media:content","img"],
    }
  });

  const results = [];
  const feed = await parser.parseURL(url);
  feed.items.forEach(item => {
    let image = val(item.enclosure) ? item.enclosure.url : "";
    if (image.length == 0) {
      const imgs = ["media:content","image","img"];

      imgs.map(img => {
        if (val(item[img])) {
          switch (img) {
            case "media:content":
              image = item["media:content"]["$"].url;
              break;

            default:
              image = item[img];
              break;
          }
        }
      });

      if (image.length == 0) {
        let pict = item.content.split(">");
        pict = pict[0].replace("<img " , "");
        const imgs = pict.split(" ");
        imgs.map(im => {
          const img = im.split('=');
          if (img[0] === "src")
          image = img[1].replace(/"/g, "");
        });
      }
    }

    const result = {
      link: item.link.split("?")[0],
      title: item.title.trim(),
      content: item.contentSnippet,
      image: image,
      date: val(item.isoDate) ? Date.parse(item.isoDate) : Date.now(),
      creator: val(item.creator),
      categories: val(item.categories, [])
    };

    results.push(result);
  });

  return results;
};

const stem = (value) => {
  let result = "";
  if (val(value)) {
    const word = nalapa.word;
    if (!word.isStopword(value))
      result = word.stem(value).toLowerCase();
  }

  return result;
};

const val = (value , def) => {
  const d = typeof def !== "undefined" ? def : false;
  return typeof value !== "undefined" ? value : d;
}

fastify.get('/', async (request, reply) => {
  const search = stem(request.query.search);

  const promises = [] , 
    results = [] , 
    links = [],
    rss = [
    "https://www.antaranews.com/rss/top-news",
    "https://www.antaranews.com/rss/ekonomi",
    /* "http://rss.detik.com/index.php/detikcom_nasional",
    "https://rss.detik.com/index.php/finance", */
    "https://www.suara.com/rss/bisnis",
    "https://www.suara.com/rss/news",
    "https://www.vice.com/id_id/rss",
    "https://feed.liputan6.com/rss",
    "https://www.cnnindonesia.com/ekonomi/rss",
    "https://www.cnnindonesia.com/nasional/rss",
    "https://www.cnbcindonesia.com/news/rss",
    "https://www.cnbcindonesia.com/market/rss/",
    "https://rss.tempo.co/nasional",
    "https://rss.tempo.co/bisnis",
    "https://www.republika.co.id/rss"
  ];
  rss.map(promise => {
    promises.push(news(promise));
  });
  
  let prom = await Promise.all(promises);
  prom.map(fetchs => {
    fetchs.map(fetch => {
      const link = fetch.link;

      if (!links.includes(link)) {
        const cleaner = nalapa.cleaner;
        fetch.content = cleaner.removeHTMLTags(fetch.content)
                                .replace(/[\n\r]/g, ' ')
                                .replace('…', ' ...')
                                .replace(/\s+/g, ' ').trim();
        
        const tokens = [];
        const token = nalapa.tokenizer;
        const tokenize = token.tokenize(fetch.content);
        tokenize.map(token => {
          const tkn = stem(token);
          if (!tokens.includes(tkn) && tkn.length > 2)
            tokens.push(tkn);
        });
        fetch.token = tokens;
        
        let push = search.length > 0 ? false : true;
        if (search.length > 0) {
          push = tokens.find(token => {
            return token.includes(search);
          });
        }
        
        if (push) {
          results.push(fetch);
          links.push(link);
        }
      }
    });
  });

  reply
    .code(201)
    .send(results.sort((a, b) => {
      if (a.date > b.date) {
        return -1;
      } else if (a.date < b.date) {
        return 1;
      } else {
        return 0;
      }
    }));
});

const start = async () => {
  try {
    await fastify.listen(3000)
    fastify.log.info(`server listening on ${fastify.server.address().port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
};
start();