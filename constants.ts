import { Problem, LeaderboardEntry, SolvedProblem } from './types';

export const PROBLEMS: Problem[] = [
  {
    id: 1,
    statement: "Let ABC be a triangle. Prove that there is a line L (in the plane of triangle ABC) such that the distance from L to A, the distance from L to B, and the distance from L to C are equal.",
    topic: "Geometry",
    hints: [
      "Consider the lines that are parallel to the sides of the triangle.",
      "Think about the incenter and excenters of the triangle. The lines equidistant from three points (the vertices) are related to the angle bisectors.",
      "There are four such lines. They are the external angle bisectors of the triangle, which act as the axes of symmetry for pairs of vertices."
    ],
  },
  {
    id: 2,
    statement: "Find all positive integers $n$ such that $n^2 + 1$ is divisible by $n + 1$.",
    topic: "Number Theory",
    hints: [
      "Try to use polynomial long division or algebraic manipulation on the expression $(n^2 + 1) / (n + 1)$.",
      "Rewrite the numerator $n^2 + 1$ as $(n^2 - 1) + 2$. Notice that $n^2 - 1$ is divisible by $n + 1$.",
      "The expression simplifies to $(n - 1) + 2/(n + 1)$. For this to be an integer, $n + 1$ must be a divisor of 2. Since $n$ is positive, $n + 1$ can be 1 or 2. This means $n=0$ (not positive) or $n=1$. The only solution is $n=1$."
    ],
  },
  {
    id: 3,
    statement: "Find the number of ordered pairs of integers $(x, y)$ such that $x^2 + y^2 = 2024$.",
    topic: "Number Theory",
    hints: [
        "Consider the equation modulo 4. The square of any integer is congruent to either $0$ or $1 \\pmod{4}$.",
        "The sum of two squares, $x^2 + y^2$, can therefore only be congruent to $0, 1$, or $2 \\pmod{4}$. What is $2024 \\pmod{4}$?",
        "$2024$ is divisible by 4, so $2024 \\equiv 0 \\pmod{4}$. This requires $x^2 \\equiv 0 \\pmod{4}$ and $y^2 \\equiv 0 \\pmod{4}$, which means both $x$ and $y$ must be even. Let $x=2a, y=2b$ and substitute this back into the equation. You'll get $a^2+b^2 = 506$. Repeat the process. You'll find there are no integer solutions, so the number of pairs is 0."
    ],
  },
  {
    id: 4,
    statement: "In a group of 10 people, every person has exactly 3 friends. (Friendship is mutual). Prove that it is possible to select 4 people and seat them at a round table so that every two neighbors are friends.",
    topic: "Combinatorics",
    hints: [
      "This structure can be modeled as a 3-regular graph with 10 vertices. The problem is asking to prove the existence of a cycle of length 4 (a $C_4$).",
      "Pick an arbitrary vertex $v$. It has three neighbors: $n_1, n_2$, and $n_3$. Consider the neighbors of $n_1$ (other than $v$). If any two of $n_1$'s neighbors are also neighbors of each other, what does that form?",
      "Pick a vertex $v$ and its neighbor $u$. $v$ has two other neighbors ($v_1, v_2$) and $u$ has two other neighbors ($u_1, u_2$). If any of $v$'s 'other' neighbors is the same as $u$'s 'other' neighbors (e.g., $v_1=u_1$), a $C_4$ is formed ($v-u-u_1-v_1-v$). It can be proven this must occur in any 3-regular graph of this size."
    ],
  },
  {
    id: 5,
    statement: "Let $a, b, c$ be positive real numbers. Prove that $(a+b)(b+c)(c+a) \\ge 8abc$.",
    topic: "Algebra",
    hints: [
        "Expanding the left-hand side is possible, but it can be messy. Is there a more elegant inequality theorem you can apply?",
        "Try using the AM-GM (Arithmetic Mean - Geometric Mean) inequality on pairs of variables. What does AM-GM tell you about $(a+b)$?",
        "By AM-GM, $\\frac{a+b}{2} \\ge \\sqrt{ab}$, so $a+b \\ge 2\\sqrt{ab}$. Apply this to all three terms: $(a+b)(b+c)(c+a) \\ge (2\\sqrt{ab}) \\cdot (2\\sqrt{bc}) \\cdot (2\\sqrt{ca})$. Simplify the right-hand side to complete the proof."
    ]
  },
  {
    id: 6,
    statement: "Find all functions $f: \\mathbb{R} \\to \\mathbb{R}$ such that $f(x + y) - f(x - y) = 4xy$ for all $x, y \\in \\mathbb{R}$.",
    topic: "Algebra",
    hints: [
        "This is a known functional equation. Start by substituting specific values. What happens if $x=0$?",
        "Setting $x=0$ gives $f(y) - f(-y) = 0$, which means $f(y) = f(-y)$, so the function is even. Now, try setting $y=x$.",
        "Setting $y=x$ gives $f(2x) - f(0) = 4x^2$. If we let $u=x+y$ and $v=x-y$, we can show that $f(u) - u^2 = f(v) - v^2$ for any $u,v$. This implies $f(x) - x^2 = C$ for some constant $C$. So, $f(x) = x^2 + C$. Verify this solution in the original equation."
    ]
  }
];

export const LEADERBOARD_DATA: LeaderboardEntry[] = [
  { rank: 1, name: "Alexandre P.", score: 4200, country: "FRA" },
  { rank: 2, name: "Yuhan Z.", score: 4150, country: "CHN" },
  { rank: 3, name: "Ben C.", score: 3980, country: "USA" },
  { rank: 4, name: "Danila M.", score: 3800, country: "RUS" },
  { rank: 5, name: "Linh N.", score: 3750, country: "VNM" },
  { rank: 6, name: "David E.", score: 3600, country: "ROU" },
  { rank: 7, name: "Sarah K.", score: 3450, country: "DEU" },
  { rank: 8, name: "Mateo G.", score: 3300, country: "ESP" },
  { rank: 9, name: "Olga P.", score: 3210, country: "POL" },
  { rank: 10, name: "Kenji T.", score: 3100, country: "JPN" },
];

// Temporary data for testing the progress page without logging in
export const DUMMY_SOLVED_PROBLEMS: SolvedProblem[] = [
  {
    problem: PROBLEMS[1], // Number Theory
    timeSpent: 320,
    difficultyRating: 4,
    solvedAt: new Date('2024-07-20T10:00:00Z'),
  },
  {
    problem: PROBLEMS[0], // Geometry
    timeSpent: 650,
    difficultyRating: 7,
    solvedAt: new Date('2024-07-21T11:30:00Z'),
  },
  {
    problem: PROBLEMS[4], // Algebra (was Inequalities)
    timeSpent: 210,
    difficultyRating: 3,
    solvedAt: new Date('2024-07-22T09:00:00Z'),
  },
  {
    problem: PROBLEMS[3], // Combinatorics
    timeSpent: 800,
    difficultyRating: 8,
    solvedAt: new Date('2024-07-22T15:45:00Z'),
  },
  {
    problem: PROBLEMS[2], // Number Theory
    timeSpent: 450,
    difficultyRating: 6,
    solvedAt: new Date('2024-07-23T14:00:00Z'),
  },
  {
    problem: PROBLEMS[5], // Algebra (was Functional Equations)
    timeSpent: 512,
    difficultyRating: 7,
    solvedAt: new Date('2024-07-24T18:00:00Z'),
  },
  {
    problem: PROBLEMS[1], // Number Theory again
    timeSpent: 180,
    difficultyRating: 2,
    solvedAt: new Date('2024-07-25T10:20:00Z'),
  }
];