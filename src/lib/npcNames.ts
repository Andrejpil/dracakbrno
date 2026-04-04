const NAME_POOLS: Record<string, { male: string[]; female: string[] }> = {
  Člověk: {
    male: [
      'Radek', 'Bruno', 'Tomáš', 'Karel', 'Jaroslav', 'Vladimír', 'Ondřej', 'Marek',
      'Štěpán', 'Dominik', 'Lukáš', 'Petr', 'Jan', 'Miloš', 'Vojtěch', 'Dalibor',
      'Zdeněk', 'Bedřich', 'Arnošt', 'Havel', 'Bořek', 'Ctibor', 'Dobroslav', 'Jaromír',
    ],
    female: [
      'Alena', 'Božena', 'Dagmar', 'Eva', 'Helena', 'Ivana', 'Jitka', 'Kateřina',
      'Ludmila', 'Markéta', 'Nela', 'Olga', 'Pavla', 'Růžena', 'Sylvie', 'Vendula',
      'Zora', 'Milada', 'Doubravka', 'Vlasta', 'Libuše', 'Blanka', 'Anežka', 'Drahomíra',
    ],
  },
  Elf: {
    male: [
      'Stivian', 'Aelindor', 'Caladrel', 'Elanthir', 'Faelorn', 'Galathor', 'Isilmir',
      'Liranthel', 'Miravel', 'Naelindor', 'Quennar', 'Rivanel', 'Silvaren', 'Thalion',
      'Vaelorn', 'Arannis', 'Erethil', 'Fenarel', 'Haldir', 'Lindorel',
    ],
    female: [
      'Aelindra', 'Caelith', 'Elariel', 'Faelwen', 'Galadria', 'Isilwen', 'Liriel',
      'Miraviel', 'Naelith', 'Quelenna', 'Rivaniel', 'Silvariel', 'Thaliel', 'Vaelith',
      'Aranniel', 'Erethiel', 'Fenariel', 'Haldiel', 'Lindoriel', 'Anariel',
    ],
  },
  Trpaslík: {
    male: [
      'Daldur Dlouhovous', 'Thorin Kovadlina', 'Balin Kladivák', 'Gimrak Železnopěst',
      'Durin Skalolom', 'Bofur Černohlav', 'Grolin Ohnivý', 'Nori Štítonoš',
      'Dwalin Buchar', 'Fundin Rudovous', 'Gloin Zlatotepec', 'Oin Rudomlat',
      'Kili Sekyrník', 'Fili Stříbrovous', 'Bombur Pivař', 'Bifur Hlubinář',
      'Thrain Železný', 'Dain Tvrdohlavý', 'Nain Kameník', 'Frerin Jasný',
    ],
    female: [
      'Disa Kovářka', 'Hilda Kladivice', 'Brunhild Železná', 'Greta Skalní',
      'Thyra Rudovláska', 'Sigrid Hlubinná', 'Freya Zlatovláska', 'Inga Tvrdá',
      'Astrid Ohnivá', 'Helga Černohlávka', 'Dagny Stříbrná', 'Runa Kamenná',
      'Gudrun Pevná', 'Svala Štítová', 'Ylva Důlní', 'Brynhild Sekyrnice',
    ],
  },
  Barbar: {
    male: [
      'Gromm Divočák', 'Thorg Krvavý', 'Ulfgar Drtič', 'Korak Hromobij',
      'Brak Vlkožrout', 'Dragan Zuřivý', 'Sven Medvědí', 'Ragnar Bouřlivý',
      'Bjorn Ocelový', 'Hrothgar Temný', 'Wulfric Divoký', 'Gorath Silný',
      'Tormund Severský', 'Kargoth Mohutný', 'Volkar Dravý', 'Grimjaw Nelítostný',
    ],
    female: [
      'Brunhilda Divoká', 'Helga Krvavá', 'Sigrun Bouřná', 'Freydis Zuřivá',
      'Thyra Vlčice', 'Astrid Drtička', 'Ragnhild Ocelová', 'Svanhild Severská',
      'Gunnhild Mohutná', 'Brynhild Silná', 'Yrsa Temná', 'Vigdis Dravá',
    ],
  },
  Gnom: {
    male: [
      'Fizzwick Šroubek', 'Gimble Kolečko', 'Namfoodle Pružinka', 'Bimpnottin Převodík',
      'Zook Páčidlo', 'Roondar Ciferník', 'Warryn Trychtýř', 'Dimble Ventil',
      'Eldon Řetízek', 'Gerbo Ozubek', 'Jebeddo Svíčka', 'Alston Měřidlo',
      'Brocc Hodinář', 'Burgell Kompas', 'Fonkin Hmoždíř', 'Glim Křesadlo',
    ],
    female: [
      'Bimpsy Pružinka', 'Caramip Zvonečka', 'Ellywick Ciferka', 'Lilli Kolečko',
      'Nissa Šroubička', 'Orla Převodka', 'Roywyn Ventilka', 'Shamil Řetízka',
      'Tana Ozubka', 'Waywocket Svíčka', 'Zanna Křesadla', 'Donella Hodinářka',
    ],
  },
  Obr: {
    male: [
      'Gromash Skalodrtič', 'Urgok Zemětřas', 'Mogul Horolomec', 'Thokk Údolák',
      'Grunnok Balvanožrout', 'Skullak Velkopěst', 'Bolgur Kamínkodrtič', 'Durgath Hřmot',
      'Krunk Drtivec', 'Mograth Útesák', 'Thragg Mohylák', 'Gruumak Stěnolam',
    ],
    female: [
      'Grunda Skalní', 'Urgara Zemětřaska', 'Mogula Horolámka', 'Thokka Údolačka',
      'Skulda Velká', 'Bolgara Kamenná', 'Durgatha Hřmotná', 'Krunka Drtivá',
      'Mogratha Útesová', 'Thragga Mohylová', 'Gruumaka Stěnová', 'Grunnoka Balvanová',
    ],
  },
  Půlčík: {
    male: [
      'Bilbo Pytlík', 'Meriadok Brandorád', 'Peregrin Bral', 'Samvěd Křepelák',
      'Frodo Váček', 'Lotho Váčkář', 'Fredegar Tlusťoch', 'Folko Zelínek',
      'Drogo Kopečník', 'Griffo Lučník', 'Hamfast Zahrádkář', 'Isembold Krčmář',
      'Largo Travička', 'Mosco Potůček', 'Odo Měšťák', 'Polo Koláčník',
    ],
    female: [
      'Rosie Zahradnice', 'Lobélie Pytlíková', 'Estela Brandová', 'Primula Váčková',
      'Angelika Kopečná', 'Belinda Lučnice', 'Camellia Zelená', 'Daisy Travičková',
      'Eglantine Krčmářka', 'Golda Koláčnice', 'Hilda Potůčková', 'Jasmine Měšťačka',
    ],
  },
};

export type NPCRace = keyof typeof NAME_POOLS;

export const NPC_RACES = Object.keys(NAME_POOLS) as NPCRace[];

export type NPCGender = 'male' | 'female' | 'random';

export function generateRandomName(race: NPCRace, gender: NPCGender = 'random'): string {
  const pool = NAME_POOLS[race];
  const g = gender === 'random' ? (Math.random() < 0.5 ? 'male' : 'female') : gender;
  const names = pool[g];
  return names[Math.floor(Math.random() * names.length)];
}
