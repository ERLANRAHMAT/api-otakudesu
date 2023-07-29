const axios = require("axios");
const cheerio = require("cheerio");
const baseURL = `https://otakudesu.lol/`;

const toDate = (str) => {
  const month = {
    Januari: "January",
    Februari: "February",
    Maret: "March",
    April: "April",
    Mei: "May",
    Juni: "June",
    Juli: "July",
    Agustus: "August",
    September: "September",
    Oktober: "October",
    November: "November",
    Desember: "December",
  };
  return new Date(
    str.replace(
      /Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember/,
      (e) => month[e]
    )
  );
};
const getTitle = (it) => {
  let te = it.text();
  te = te
    .slice(te.match(/OVA|BD|Episode/).index, te.indexOf("Subtitle"))
    .trim();
  return te.includes("OVA") ? te.replace("Episode ", "") : te;
};

class Otakudesu {
  async home(req, res) {
    try {
      const { data } = await axios.get(baseURL);
      const $ = cheerio.load(data);

      const on_going = $(".rseries:nth-child(1) > .rapi:nth-child(1) .detpost")
        .toArray()
        .map((ele) => {
          return {
            title: $(ele).find("h2").text(),
            id: $(ele).find("a").attr("href").split("/")[4],
            thumb: $(ele).find("img").attr("src"),
            episode: $(ele).find(".epz").text().trim(),
            uploaded_on: $(ele).find(".newnime").text(),
            day_updated: $(ele).find(".epztipe").text().trim(),
          };
        });

      const complete = $(".rseries:nth-child(4) .detpost")
        .toArray()
        .map((ele) => {
          return {
            title: $(ele).find("h2").text(),
            id: $(ele).find("a").attr("href").split("/")[4],
            thumb: $(ele).find("img").attr("src"),
            episode: $(ele).find(".epz").text().trim(),
            uploaded_on: $(ele).find(".newnime").text(),
            score: $(ele).find(".epztipe").text().trim(),
          };
        });

      return res.json({
        success: true,
        on_going,
        complete,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error,
      });
    }
  }
  async anime(req, res) {
    const URL = baseURL + `anime/${req.params.id}`;
    let data;
    try {
      data = (await axios.get(URL)).data;
    } catch {
      return res
        .status(404)
        .json({ success: false, message: "Data not found" });
    }
    const $ = cheerio.load(data);

    const information = $(".infozingle b")
      .map((i, elem) => $(elem).text() + ": ")
      .get();
    const temp = $(".infozingle")
      .text()
      .split(new RegExp(information.join("|")));

    const synopsis = $(".sinopc > p")
      .toArray()
      .map((ele) => $(ele).text())
      .join("\n\n")
      .split("Tonton")[0]
      .trim();

    const details = {
      id: req.params.id.replace(/-sub-indo|sub-indo|-subtitle-indonesia/g, ""),
      thumb: $(".fotoanime img").attr("src"),
      title: temp[1],
      japanese: temp[2],
      score: temp[3],
      producer: temp[4],
      type: temp[5],
      status: temp[6],
      episodes: temp[7],
      duration: temp[8],
      release_date: temp[9],
      studio: temp[10],
      genre: temp[11].split(", "),
      synopsis,
      related,
      updated_on: $('meta[property="article:modified_time"]').attr("content"),
    };

    const episode_list = $(".episodelist:nth-child(8) > ul > li")
      .toArray()
      .map((ele, i, ar) => {
        const it = $(ele).find("a");
        return {
          index: ar.length - i - 1,
          id: it.attr("href").split("/")[3],
          title: getTitle(it),
          date: toDate(
            $(ele).find(".zeebr").text().replace(",", " ")
          ).toLocaleDateString("id", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }),
        };
      });

    const lengkap = $(".episodelist:nth-child(10) > ul > li")
      .toArray()
      .map((ele, i, ar) => {
        const it = $(ele).find("a");
        return {
          id: it.attr("href").split("/")[4],
          title: it.text().split(" : ")[1],
          date: toDate(
            $(ele).find(".zeebr").text().replace(",", " ")
          ).toLocaleDateString("id", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }),
        };
      });

    res.json({
      success: true,
      details,
      episode_list,
      lengkap,
    });
  }
  async lengkap(req, res) {
    try {
      const { data } = await axios.get(baseURL + `/lengkap/${req.params.id}/`);
      const $ = cheerio.load(data);

      const updated_on = new Date(
        $('meta[property="article:modified_time"]').attr("content")
      );

      const information = $(".infos > b")
        .map((i, elem) => $(elem).text() + ": ")
        .get();
      const temp = $(".infos")
        .text()
        .split(new RegExp(information.join("|")));

      // Handle the episode
      const date = updated_on.toLocaleDateString("id", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      const temp2 = $(".download:nth-child(4) > ul").toArray();

      const episode_list = $(".download:nth-child(4) > h4")
        .map((i, elem) => {
          const title = getTitle($(elem));

          const download_links = $(temp2[i])
            .find("li")
            .map((a, ele) => {
              return {
                quality: $(ele).find("strong").text(),
                links: $(ele)
                  .find("a")
                  .map((b, el) => {
                    return { host: $(el).text(), url: $(el).attr("href") };
                  })
                  .get(),
                size: $(ele).find("i").text(),
              };
            })
            .get();

          return {
            index: i,
            id:
              req.params.id.replace(
                /-sub-indo|sub-indo|-subtitle-indonesia/g,
                ""
              ) +
              "-" +
              title.toLowerCase().split(" (")[0].replace(/ /g, "-"),
            animeId: $("h6 > a")
              .attr("href")
              .split("/")[4]
              .replace(/-sub-indo|sub-indo|-subtitle-indonesia/g, ""),
            animeTitle: temp[2],
            title,
            download_links,
            updated_on: date,
          };
        })
        .get();

      res.json({ success: true, episode_list });
    } catch {
      res.status(404).json({ success: false, message: "Data not found" });
    }
  }
  async episode(req, res) {
    const URL = baseURL + req.params.id;
    let data;
    try {
      data = (await axios.get(URL)).data;
    } catch {
      return res
        .status(404)
        .json({ success: false, message: "Data not found" });
    }
    const $ = cheerio.load(data);

    let download_links = $(".download ul:nth-child(2) li")
      .map((i, ele) => {
        const links = $(ele)
          .find("a")
          .toArray()
          .map((elem) => {
            return {
              host: $(elem).text(),
              url: $(elem).attr("href"),
            };
          });
        return {
          quality: $(ele).find("strong").text().replace("Mp4 ", ""),
          links,
          size: $(ele).find("i").text(),
        };
      })
      .get();

    // Handle Old Data
    if (!download_links.length) {
      const titles = $(".yondarkness-title div").toArray();
      const items = $(".yondarkness-item div").toArray();

      for (let i = 0; i < titles.length; i++) {
        const temp = $(titles[i]).text().split(/\[|\]/);

        const links = $(items[i])
          .find("a")
          .toArray()
          .map((e) => {
            return {
              host: $(e).text(),
              url: $(e).attr("href"),
            };
          });

        download_links.push({
          quality: temp[1],
          links,
          size: temp[3],
        });
      }
    }

    res.json({
      success: true,
      index: $(".keyingpost a")
        .toArray()
        .reverse()
        .findIndex((e) => $(e).attr("href").includes(req.params.id)),
      id: req.params.id.replace(/-sub-indo|sub-indo|-subtitle-indonesia/g, ""),
      animeId: $(".alert-info.alert li a").last().attr("href").split("/")[4],
      animeTitle: $("li b").text(),
      title: getTitle($(".posttl")),
      download_links,
      updated_on: new Date(
        $('meta[property="article:published_time"]').attr("content")
      ).toLocaleDateString("id", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    });
  }
  async complete(req, res) {
    const URL = baseURL + `complete-anime/page/${req.params.page}`;
    try {
      const { data } = await axios.get(URL);
      const $ = cheerio.load(data);

      const animes = $(".detpost")
        .toArray()
        .map((ele) => {
          return {
            title: $(ele).find("h2").text(),
            id: $(ele).find("a").attr("href").split("/")[4],
            thumb: $(ele).find("img").attr("src"),
            episode: $(ele).find(".epz").text().trim(),
            uploaded_on: $(ele).find(".newnime").text(),
            score: $(ele).find(".epztipe").text().trim(),
          };
        });

      res.json({
        success: true,
        animes,
        next: $(".next").length ? +req.params.page + 1 : null,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error });
    }
  }
  async search(req, res) {
    const URL =
      baseURL + `?s=${req.params.query.replace(/ /g, "+")}&post_type=anime`;
    try {
      const { data } = await axios.get(URL);
      const $ = cheerio.load(data);

      const result = $(".chivsrc li")
        .toArray()
        .map((e) => {
          const link = $(e).find("a").first();
          return {
            id: link.attr("href").split("/")[4],
            thumb: $(e).find("img").attr("src"),
            title: link
              .text()
              .split(" : ")[0]
              .replace(/ \(.*\)| Subtitle Indonesia/g, ""),
            status: $(e).find(".set:nth-child(4)").text().split(": ")[1],
            score: $(e).find(".set:nth-child(5)").text().split(": ")[1],
          };
        });

      res.json(result);
    } catch (error) {
      res.status(500).json([]);
    }
  }
  async genre(req, res) {
    const URL = baseURL + `genres/${req.params.id}/page/${req.params.page}`;
    try {
      const { data } = await axios.get(URL);
      const $ = cheerio.load(data);

      const final = $(".col-anime")
        .toArray()
        .map((ele) => {
          const link = $(ele).find("a").first();
          const ep = parseInt($(ele).find(".col-anime-eps").text());
          return {
            id: link.attr("href").split("/")[4],
            thumb: $(ele).find("img").attr("src"),
            title: link.text(),
            text: (isNaN(ep) ? "?" : ep) + " Episode",
            score: $(ele).find(".col-anime-rating").text() ?? "N/A",
          };
        });

      res.json(final);
    } catch (error) {
      res.status(404).json([]);
    }
  }
  async thumb(req, res) {
    const URL =
      baseURL +
      (isNaN(req.params.id) ? `anime/${req.params.id}` : `?p=${req.params.id}`);
    try {
      const { data } = await axios.get(URL);
      const $ = cheerio.load(data);

      res.redirect($(".fotoanime img").attr("src"));
    } catch (error) {
      res.status(500).json({ success: false, message: error });
    }
  }
  async schedule(req, res) {
    const URL = baseURL + "batch";
    try {
      const { data } = await axios.get(URL);
      const $ = cheerio.load(data);
      const schedule = [
        {
          day: "Senin",
          animes: [],
        },
        {
          day: "Selasa",
          animes: [],
        },
        {
          day: "Rabu",
          animes: [],
        },
        {
          day: "Kamis",
          animes: [],
        },
        {
          day: "Jumat",
          animes: [],
        },
        {
          day: "Sabtu",
          animes: [],
        },
        {
          day: "Minggu",
          animes: [],
        },
        {
          day: "Random",
          animes: [],
        },
      ];
      $(".detpost").each((i, ele) => {
        const d = $(ele).find(".epztipe").text().trim();
        const da = {
          title: $(ele).find("h2").text(),
          id: $(ele).find("a").attr("href").split("/")[4],
          thumb: $(ele).find("img").attr("src"),
          episode: $(ele).find(".epz").text().trim(),
        };

        switch (d) {
          case "Senin":
            schedule[0].animes.push(da);
            break;

          case "Selasa":
            schedule[1].animes.push(da);
            break;

          case "Rabu":
            schedule[2].animes.push(da);
            break;

          case "Kamis":
            schedule[3].animes.push(da);
            break;

          case "Jumat":
            schedule[4].animes.push(da);
            break;

          case "Sabtu":
            schedule[5].animes.push(da);
            break;

          case "Minggu":
            schedule[6].animes.push(da);
            break;

          case "Random":
            schedule[7].animes.push(da);
            break;

          default:
            break;
        }
      });

      res.json({ success: true, schedule });
    } catch (error) {
      res.status(500).json({ success: false, message: error });
    }
  }
}

module.exports = new Otakudesu();
