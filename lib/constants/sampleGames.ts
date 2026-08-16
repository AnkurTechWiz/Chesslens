export interface SampleGame {
  id: string;
  title: string;
  subtitle: string;
  pgn: string;
}

export const SAMPLE_GAMES: SampleGame[] = [
  {
    id: 'kasparov-topalov',
    title: 'Kasparov vs Topalov (1999)',
    subtitle: "Kasparov's Immortal · 24.Rxd4!!",
    pgn: `[Event "Hoogovens A Group"]
[Site "Wijk aan Zee NED"]
[Date "1999.01.20"]
[Round "4"]
[White "Garry Kasparov"]
[Black "Veselin Topalov"]
[Result "1-0"]
[ECO "B07"]
[WhiteElo "2812"]
[BlackElo "2700"]

1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. Be3 Bg7 5. Qd2 c6 6. f3 b5 7. Nge2 Nbd7 8. Bh6
Bxh6 9. Qxh6 Bb7 10. a3 e5 11. O-O-O Qe7 12. Kb1 a6 13. Nc1 O-O-O 14. Nb3 exd4
15. Rxd4 c5 16. Rd1 Nb6 17. g3 Kb8 18. Na5 Ba8 19. Bh3 d5 20. Qf4+ Ka7 21. Rhe1
d4 22. Nd5 Nbxd5 23. exd5 Qd6 24. Rxd4 cxd4 25. Re7+ Kb6 26. Qxd4+ Kxa5 27. b4+
Ka4 28. Qc3 Qxd5 29. Ra7 Bb7 30. Rxb7 Qc4 31. Qxf6 Kxa3 32. Qxa6+ Kxb4 33. c3+
Kxc3 34. Qa1+ Kd2 35. Qb2+ Kd1 36. Bf1 Rd2 37. Rd7 Rxd7 38. Bxc4 bxc4 39. Qxh8
Rd3 40. Qa8 c3 41. Qa4+ Ke1 42. f4 f5 43. Kc1 Rd2 44. Qa7 1-0`,
  },
  {
    id: 'opera-game',
    title: 'Morphy Opera Game (1858)',
    subtitle: 'Classic mating attack · Paris Opera House',
    pgn: `[Event "Paris"]
[Site "Paris FRA"]
[Date "1858.11.02"]
[Round "?"]
[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]
[ECO "C41"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7
8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7
14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`,
  },
  {
    id: 'clock-comments',
    title: 'Blitz with Clock Comments',
    subtitle: 'Sicilian Defense · %clk & %eval',
    pgn: `[Event "Rated Blitz game"]
[Site "https://lichess.org/test1234"]
[Date "2024.03.15"]
[Round "-"]
[White "PlayerOne"]
[Black "PlayerTwo"]
[Result "1-0"]
[WhiteElo "1850"]
[BlackElo "1820"]
[TimeControl "180+2"]
[ECO "B50"]
[Opening "Sicilian Defense"]

1. e4 { [%clk 0:03:00] [%eval 0.25] } 1... c5 { [%clk 0:02:59] [%eval 0.28] } 2. Nf3 { [%clk 0:02:58] [%eval 0.31] } 2... d6 { [%clk 0:02:57] [%eval 0.30] } 3. c3 { [%clk 0:02:56] [%eval 0.22] } 3... Nf6 { [%clk 0:02:54] [%eval 0.24] } 4. Be2 { [%clk 0:02:55] [%eval 0.15] } 4... Nc6 { [%clk 0:02:49] [%eval 0.40] } 5. d4 { [%clk 0:02:52] [%eval 0.38] } 5... cxd4 { [%clk 0:02:45] [%eval 0.42] } 6. cxd4 { [%clk 0:02:53] [%eval 0.39] } 6... Nxe4 { [%clk 0:02:40] [%eval 1.85] } 7. d5 { [%clk 0:02:51] [%eval 1.90] } 7... Qa5+ { [%clk 0:02:32] [%eval 2.10] } 8. Nc3 { [%clk 0:02:48] [%eval 2.15] } 8... Nxc3 { [%clk 0:02:25] [%eval 2.40] } 9. bxc3 { [%clk 0:02:47] [%eval 2.35] } 9... Ne5 { [%clk 0:02:18] [%eval 2.80] } 10. Nxe5 { [%clk 0:02:42] [%eval 3.10] } 10... Qxc3+ { [%clk 0:02:10] [%eval 4.20] } 11. Bd2 { [%clk 0:02:39] [%eval 4.35] } 11... Qxe5 { [%clk 0:02:08] [%eval 4.40] } 12. Rc1 { [%clk 0:02:35] [%eval 5.10] } 12... Bd7 { [%clk 0:01:45] [%eval 5.80] } 13. Bc3 { [%clk 0:02:30] [%eval 6.00] } 13... Qg5 { [%clk 0:01:30] [%eval 6.50] } 14. O-O { [%clk 0:02:28] [%eval 7.00] } 14... Rc8 { [%clk 0:01:15] [%eval 7.50] } 15. Qb3 { [%clk 0:02:20] [%eval 8.20] } 15... b6 { [%clk 0:00:55] [%eval 9.00] } 16. Ba6 { [%clk 0:02:15] [%eval 9.50] } 16... Rc5 { [%clk 0:00:40] [%eval #3] } 17. Bb4 { [%clk 0:02:10] [%eval #2] } 17... Rxc1 { [%clk 0:00:25] [%eval #1] } 18. Rxc1 { [%clk 0:02:08] [%eval #1] } 18... Qxc1+ { [%clk 0:00:18] [%eval #1] } 19. Bf1 { [%clk 0:02:06] } 1-0`,
  },
  {
    id: '60-moves',
    title: 'Carlsen vs Caruana (2018)',
    subtitle: 'World Championship · 53-Move Endgame',
    pgn: `[Event "World Championship 34th"]
[Site "London"]
[Date "2018.11.28"]
[Round "12"]
[White "Carlsen, Magnus"]
[Black "Caruana, Fabiano"]
[Result "1/2-1/2"]
[ECO "B33"]
[WhiteElo "2835"]
[BlackElo "2832"]

1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 e5 6. Ndb5 d6 7. Nd5 Nxd5
8. exd5 Ne7 9. c4 Ng6 10. Qa4 Bd7 11. Qb4 Bf5 12. h4 h5 13. Qa4 Bd7 14. Qb4
Bf5 15. Be3 a6 16. Nc3 Qc7 17. g3 Be7 18. f3 Nf8 19. Ne4 Nd7 20. Bd3 O-O
21. O-O a5 22. Qd2 Bg6 23. Rac1 b6 24. b3 Nc5 25. Bc2 Qd7 26. Kg2 Rab8 27. a4
Bf5 28. Nf2 g6 29. Rce1 Bxc2 30. Qxc2 Qf5 31. Qxf5 gxf5 32. Bxc5 bxc5 33. Re3
Kg7 34. f4 e4 35. Rd1 Bf6 36. Rd2 Bd4 37. Rde2 Bxe3 38. Rxe3 Kf6 39. Nh3 Ke7
40. Kf2 Rb6 41. Ke2 Rfb8 42. Kd2 Rxb3 43. Rxb3 Rxb3 44. Ng5 Ra3 45. Kc2 Rxa4
46. Kb3 Rb4+ 47. Kc3 a4 48. g4 hxg4 49. h5 a3 50. h6 a2 51. h7 a1=Q+ 52. Kd2
Rb2+ 53. Kc3 Qa3# 0-1`,
  },
];
